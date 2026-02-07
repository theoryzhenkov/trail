/**
 * Tree Converter - Converts Lezer syntax tree to typed AST node instances
 *
 * This module is a thin dispatcher that bridges the Lezer parser output
 * to the typed node class instances. Conversion logic lives in each node
 * class via static fromSyntax() methods, registered with the converter
 * registry via @register({ term: "..." }).
 *
 * Structural converters (ParenExpr, SimpleLiteral, FunctionCall, GroupReference)
 * are registered here since they don't map 1:1 to a node class.
 */

import type {SyntaxNode, Tree} from "@lezer/common";
import * as Terms from "../codemirror/parser.terms";
import type {Span} from "./types";
import type {ExprNode} from "./base/ExprNode";
import {FunctionExprNode} from "./base/FunctionExprNode";
import {
	registry,
	registerConverter,
	getFunctionClass,
	type ConvertContext,
	type ExprConverterFn,
} from "./registry";

import {QueryNode} from "./clauses";
import {AggregateNode, type AggregateFunc} from "./expressions";
import {PropertyNode} from "./expressions/PropertyNode";

// ============================================================================
// Initialization - Import node classes to trigger @register decorators
// ============================================================================

let initialized = false;

/**
 * Initialize the tree converter by importing all node classes.
 * This triggers @register decorators which register converters.
 * 
 * Call this before using the converter, or call it lazily on first parse.
 */
export function initializeConverter(): void {
	if (initialized) return;
	initialized = true;

	// Import functions to trigger @register decorators
	void import("./functions");
	// Import builtins to trigger @register decorators
	void import("./builtins");
	// Import node classes with fromSyntax to trigger term registration
	void import("./literals/StringNode");
	void import("./literals/NumberNode");
	void import("./literals/BooleanNode");
	void import("./literals/NullNode");
	void import("./literals/DurationNode");
	void import("./expressions/OrExprNode");
	void import("./expressions/AndExprNode");
	void import("./expressions/NotExprNode");
	void import("./expressions/ArithExprNode");
	void import("./expressions/CompareExprNode");
	void import("./expressions/PropertyNode");
	void import("./expressions/DateExprNode");
	void import("./expressions/InlineQueryNode");

	// Register structural converters
	registerStructuralConverters();
}

/**
 * Register structural converters that don't map 1:1 to a node class
 */
function registerStructuralConverters(): void {
	registerConverter("ParenExpr", (node: SyntaxNode, ctx: ConvertContext): ExprNode => {
		const kids = ctx.allChildren(node);
		for (const kid of kids) {
			if (ctx.isExpr(kid)) {
				return ctx.expr(kid);
			}
		}
		throw new Error("Empty parenthesized expression");
	});

	registerConverter("SimpleLiteral", (node: SyntaxNode, ctx: ConvertContext): ExprNode => {
		const kids = ctx.allChildren(node);
		if (kids.length === 0) throw new Error("Empty SimpleLiteral");
		return ctx.expr(kids[0]!);
	});

	registerConverter("FunctionCall", (node: SyntaxNode, ctx: ConvertContext): ExprNode => {
		const funcNameNode = node.getChild("FunctionName");
		if (!funcNameNode) throw new Error("Missing function name");
		const name = ctx.text(funcNameNode);

		// Check if this is an aggregate function
		if (AggregateNode.isAggregate(name)) {
			return AggregateNode.fromSyntax(node, name as AggregateFunc, ctx);
		}

		// Regular function - parse arguments
		const argList = node.getChild("ArgList");
		const args: ExprNode[] = [];
		if (argList) {
			const argKids = ctx.allChildren(argList);
			for (const kid of argKids) {
				if (ctx.isExpr(kid)) {
					args.push(ctx.expr(kid));
				}
			}
		}

		// Look up the function in the registry
		const FuncClass = getFunctionClass(name);
		if (!FuncClass) {
			throw new Error(`Unknown function: ${name}`);
		}

		// Validate arity at parse time
		const minArity = (FuncClass as unknown as typeof FunctionExprNode).minArity ?? 0;
		const maxArity = (FuncClass as unknown as typeof FunctionExprNode).maxArity ?? Infinity;
		if (args.length < minArity) {
			throw new Error(`${name}() requires at least ${minArity} argument(s), got ${args.length}`);
		}
		if (args.length > maxArity) {
			throw new Error(`${name}() accepts at most ${maxArity} argument(s), got ${args.length}`);
		}

		return new FuncClass(args, ctx.span(node));
	});

	registerConverter("GroupReference", (node: SyntaxNode, ctx: ConvertContext): ExprNode => {
		const stringNode = node.getChild("String");
		if (!stringNode) throw new Error("Missing string in group reference");
		const groupName = ctx.parseString(ctx.text(stringNode));
		return new PropertyNode(["@group", groupName], ctx.span(node), false);
	});
}

// ============================================================================
// Converter Map - built lazily from registry
// ============================================================================

let converterMap: Map<number, ExprConverterFn> | null = null;
let exprTermIds: Set<number> | null = null;

function getConverterMap(): Map<number, ExprConverterFn> {
	initializeConverter(); // Ensure converters are registered
	if (!converterMap) {
		converterMap = new Map();
		const termsRecord = Terms as unknown as Record<string, number>;
		for (const [termName, converter] of registry.getAllConvertersByTermName()) {
			const termId = termsRecord[termName];
			if (termId !== undefined) {
				converterMap.set(termId, converter);
			}
		}
	}
	return converterMap;
}

function getExprTermIds(): Set<number> {
	if (!exprTermIds) {
		exprTermIds = new Set(getConverterMap().keys());
		// Add structural expression-like terms not in converter map
		exprTermIds.add(Terms.InExpr);
		exprTermIds.add(Terms.RangeExpr);
	}
	return exprTermIds;
}

// ============================================================================
// Expression Dispatcher
// ============================================================================

function convertExpression(node: SyntaxNode, ctx: ConvertContext): ExprNode {
	const converter = getConverterMap().get(node.type.id);
	if (converter) {
		return converter(node, ctx);
	}

	// Name-based fallback for @specialize tokens (Boolean, Null)
	const nameConverter = registry.getConverterByTermName(node.name);
	if (nameConverter) {
		return nameConverter(node, ctx);
	}

	throw new Error(`Unknown expression type: ${node.name} (${node.type.id})`);
}

// ============================================================================
// ConvertContext Implementation
// ============================================================================

function createConvertContext(source: string): ConvertContext {
	const ctx: ConvertContext = {
		source,
		expr(node: SyntaxNode): ExprNode {
			return convertExpression(node, ctx);
		},
		isExpr(node: SyntaxNode): boolean {
			return getExprTermIds().has(node.type.id);
		},
		span(node: SyntaxNode): Span {
			return {start: node.from, end: node.to};
		},
		text(node: SyntaxNode): string {
			return source.slice(node.from, node.to);
		},
		allChildren(node: SyntaxNode): SyntaxNode[] {
			const result: SyntaxNode[] = [];
			const cursor = node.cursor();
			if (!cursor.firstChild()) return result;
			do {
				result.push(cursor.node);
			} while (cursor.nextSibling());
			return result;
		},
		parseString(str: string): string {
			return parseStringLiteral(str);
		},
	};
	return ctx;
}

// ============================================================================
// Entry Point
// ============================================================================

/**
 * Convert a Lezer parse tree to a QueryNode
 */
export function convert(tree: Tree, source: string): QueryNode {
	const ctx = createConvertContext(source);
	return QueryNode.fromSyntax(tree.topNode, ctx);
}

// ============================================================================
// String Parsing (shared utility)
// ============================================================================

/**
 * Parse a string literal, handling escape sequences
 */
function parseStringLiteral(str: string): string {
	// Remove surrounding quotes
	if (str.startsWith('"') && str.endsWith('"')) {
		str = str.slice(1, -1);
	}

	// Process escape sequences
	let result = "";
	let i = 0;
	while (i < str.length) {
		if (str[i] === "\\") {
			i++;
			switch (str[i]) {
				case "\\":
					result += "\\";
					break;
				case '"':
					result += '"';
					break;
				case "n":
					result += "\n";
					break;
				case "t":
					result += "\t";
					break;
				default:
					result += str[i];
			}
		} else {
			result += str[i];
		}
		i++;
	}

	return result;
}
