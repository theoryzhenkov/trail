/**
 * Tree Converter - Converts Lezer syntax tree to typed AST node instances
 * 
 * This module bridges the Lezer parser output (generic SyntaxNode tree) to
 * the typed node class instances used for validation and execution.
 */

import type {SyntaxNode, Tree} from "@lezer/common";
import * as Terms from "../codemirror/parser.terms";
import type {Span} from "./types";
import {ExprNode} from "./base/ExprNode";
import {FunctionExprNode} from "./base/FunctionExprNode";
import {getFunctionClass} from "./registry";

// Import functions to trigger @register decorators
import "./functions";
// Import builtins to trigger @register decorators
import "./builtins";

// Node classes
import {QueryNode, FromNode, RelationSpecNode, SortNode, SortKeyNode, DisplayNode, PruneNode, WhereNode, WhenNode} from "./clauses";
import {
	LogicalNode,
	CompareNode,
	ArithNode,
	UnaryNotNode,
	InNode,
	RangeNode,
	PropertyNode,
	AggregateNode,
	DateExprNode,
	InlineQueryNode,
	type CompareOp,
	type AggregateFunc,
	type AggregateSource,
	type BareIdentifierSource,
	type GroupRefSource,
	type InlineQuerySource,
} from "./expressions";
import {
	StringNode,
	NumberNode,
	BooleanNode,
	NullNode,
	DurationNode,
	type DurationUnit,
	type RelativeDateKind,
} from "./literals";
import type {DateBase, DateOffset} from "./expressions/DateExprNode";

/**
 * Convert a Lezer parse tree to a QueryNode
 */
export function convert(tree: Tree, source: string): QueryNode {
	const top = tree.topNode;
	return convertQuery(top, source);
}

/**
 * Get span from a Lezer node
 */
function span(node: SyntaxNode): Span {
	return {start: node.from, end: node.to};
}

/**
 * Get text content of a node
 */
function text(node: SyntaxNode, source: string): string {
	return source.slice(node.from, node.to);
}

/**
 * Find a child node by type
 */
function child(node: SyntaxNode, type: number): SyntaxNode | null {
	let cursor = node.cursor();
	if (!cursor.firstChild()) return null;
	do {
		if (cursor.type.id === type) return cursor.node;
	} while (cursor.nextSibling());
	return null;
}

/**
 * Find all children of a specific type
 */
function children(node: SyntaxNode, type: number): SyntaxNode[] {
	const result: SyntaxNode[] = [];
	let cursor = node.cursor();
	if (!cursor.firstChild()) return result;
	do {
		if (cursor.type.id === type) result.push(cursor.node);
	} while (cursor.nextSibling());
	return result;
}

/**
 * Get all direct children of a node
 */
function allChildren(node: SyntaxNode): SyntaxNode[] {
	const result: SyntaxNode[] = [];
	let cursor = node.cursor();
	if (!cursor.firstChild()) return result;
	do {
		result.push(cursor.node);
	} while (cursor.nextSibling());
	return result;
}

// ============================================================================
// Query Conversion
// ============================================================================

function convertQuery(node: SyntaxNode, source: string): QueryNode {
	const groupNode = child(node, Terms.Group);
	const fromNode = child(node, Terms.From);
	const pruneNode = child(node, Terms.Prune);
	const whereNode = child(node, Terms.Where);
	const whenNode = child(node, Terms.When);
	const sortNode = child(node, Terms.Sort);
	const displayNode = child(node, Terms.Display);

	if (!groupNode) throw new Error("Missing group clause");
	if (!fromNode) throw new Error("Missing from clause");

	const group = convertGroupClause(groupNode, source);
	const from = convertFromClause(fromNode, source);
	const prune = pruneNode ? convertPruneClause(pruneNode, source) : undefined;
	const where = whereNode ? convertWhereClause(whereNode, source) : undefined;
	const when = whenNode ? convertWhenClause(whenNode, source) : undefined;
	const sort = sortNode ? convertSortClause(sortNode, source) : undefined;
	const display = displayNode ? convertDisplayClause(displayNode, source) : undefined;

	return new QueryNode(group, from, span(node), prune, where, when, sort, display);
}

function convertGroupClause(node: SyntaxNode, source: string): string {
	const stringNode = child(node, Terms.String);
	if (!stringNode) throw new Error("Missing group name string");
	return parseStringLiteral(text(stringNode, source));
}

function convertFromClause(node: SyntaxNode, source: string): FromNode {
	const relationSpecs = children(node, Terms.RelationSpec);
	const relations = relationSpecs.map((r) => convertRelationSpec(r, source));
	return new FromNode(relations, span(node));
}

function convertRelationSpec(node: SyntaxNode, source: string): RelationSpecNode {
	const identNode = child(node, Terms.Identifier);
	if (!identNode) throw new Error("Missing relation name");
	const name = text(identNode, source);

	let depth: number | "unlimited" = "unlimited";
	let extend: string | undefined;
	let flatten: number | true | undefined;

	const modifiers = children(node, Terms.RelationModifier);
	for (const mod of modifiers) {
		const depthNode = child(mod, Terms.Depth);
		const extendNode = child(mod, Terms.Extend);
		const flattenNode = child(mod, Terms.Flatten);

		if (depthNode) {
			const numNode = child(depthNode, Terms.Number);
			if (numNode) {
				depth = parseInt(text(numNode, source), 10);
			}
		} else if (extendNode) {
			const strNode = child(extendNode, Terms.String);
			const idNode = child(extendNode, Terms.Identifier);
			if (strNode) {
				extend = parseStringLiteral(text(strNode, source));
			} else if (idNode) {
				extend = text(idNode, source);
			}
		} else if (flattenNode) {
			const numNode = child(flattenNode, Terms.Number);
			if (numNode) {
				flatten = parseInt(text(numNode, source), 10);
			} else {
				flatten = true;
			}
		}
	}

	return new RelationSpecNode(name, depth, span(node), extend, flatten);
}

function convertPruneClause(node: SyntaxNode, source: string): PruneNode {
	const expr = convertExpressionFromClause(node, source);
	return new PruneNode(expr, span(node));
}

function convertWhereClause(node: SyntaxNode, source: string): WhereNode {
	const expr = convertExpressionFromClause(node, source);
	return new WhereNode(expr, span(node));
}

function convertWhenClause(node: SyntaxNode, source: string): WhenNode {
	const expr = convertExpressionFromClause(node, source);
	return new WhenNode(expr, span(node));
}

/**
 * Extract and convert the expression from a clause node (Prune, Where, When)
 */
function convertExpressionFromClause(node: SyntaxNode, source: string): ExprNode {
	// Find the expression child (OrExpr is the top-level expression type)
	const kids = allChildren(node);
	// Skip the keyword (first child) and get the expression
	for (const kid of kids) {
		if (isExpressionNode(kid)) {
			return convertExpression(kid, source);
		}
	}
	throw new Error(`Missing expression in clause: ${node.name}`);
}

function convertSortClause(node: SyntaxNode, source: string): SortNode {
	const keyNodes = children(node, Terms.SortKey);
	const keys = keyNodes.map((k) => convertSortKey(k, source));
	return new SortNode(keys, span(node));
}

function convertSortKey(node: SyntaxNode, source: string): SortKeyNode {
	const kids = allChildren(node);
	let key: "chain" | PropertyNode;
	let direction: "asc" | "desc" = "asc";

	for (const kid of kids) {
		if (kid.type.id === Terms.BuiltinIdentifier) {
			const builtinText = text(kid, source);
			if (builtinText === "$chain") {
				key = "chain";
			} else {
				key = convertBuiltinPropertyAccess(kid, source);
			}
		} else if (kid.type.id === Terms.PropertyAccess) {
			key = convertPropertyAccess(kid, source);
		} else if (kid.type.id === Terms.asc) {
			direction = "asc";
		} else if (kid.type.id === Terms.desc) {
			direction = "desc";
		}
	}

	if (key! === undefined) throw new Error("Missing sort key");
	return new SortKeyNode(key, direction, span(node));
}

function convertDisplayClause(node: SyntaxNode, source: string): DisplayNode {
	const displayList = child(node, Terms.DisplayList);
	if (!displayList) throw new Error("Missing display list");

	const kids = allChildren(displayList);
	let all = false;
	const properties: PropertyNode[] = [];

	for (const kid of kids) {
		if (kid.type.id === Terms.all) {
			all = true;
		} else if (kid.type.id === Terms.PropertyAccess) {
			properties.push(convertPropertyAccess(kid, source));
		}
	}

	return new DisplayNode(all, properties, span(node));
}

// ============================================================================
// Expression Conversion
// ============================================================================

/**
 * Check if a node is an expression type
 */
function isExpressionNode(node: SyntaxNode): boolean {
	return [
		Terms.OrExpr,
		Terms.AndExpr,
		Terms.NotExpr,
		Terms.CompareExpr,
		Terms.ArithExpr,
		Terms.ParenExpr,
		Terms.FunctionCall,
		Terms.InlineQuery,
		Terms.PropertyAccess,
		Terms.BuiltinIdentifier,
		Terms.SimpleLiteral,
		Terms.DateExpr,
		Terms.InExpr,
		Terms.RangeExpr,
		Terms.String,
		Terms.Number,
		Terms.Duration,
		Terms.Boolean,
		Terms.Null,
	].includes(node.type.id);
}

function convertExpression(node: SyntaxNode, source: string): ExprNode {
	switch (node.type.id) {
		case Terms.OrExpr:
			return convertOrExpr(node, source);
		case Terms.AndExpr:
			return convertAndExpr(node, source);
		case Terms.NotExpr:
			return convertNotExpr(node, source);
		case Terms.CompareExpr:
			return convertCompareExpr(node, source);
		case Terms.ArithExpr:
			return convertArithExpr(node, source);
		case Terms.ParenExpr:
			return convertParenExpr(node, source);
		case Terms.FunctionCall:
			return convertFunctionCall(node, source);
		case Terms.InlineQuery:
			return convertInlineQuery(node, source);
		case Terms.PropertyAccess:
			return convertPropertyAccess(node, source);
		case Terms.BuiltinIdentifier:
			return convertBuiltinPropertyAccess(node, source);
		case Terms.SimpleLiteral:
			return convertSimpleLiteral(node, source);
		case Terms.DateExpr:
			return convertDateExpr(node, source);
		case Terms.String:
			return convertStringLiteral(node, source);
		case Terms.Number:
			return convertNumberLiteral(node, source);
		case Terms.Duration:
			return convertDurationLiteral(node, source);
		case Terms.Boolean:
			return convertBooleanLiteral(node, source);
		case Terms.Null:
			return convertNullLiteral(node);
		default:
			// Handle nodes by name for cases where @specialize creates multiple IDs
			if (node.name === "Boolean") {
				return convertBooleanLiteral(node, source);
			}
			if (node.name === "Null") {
				return convertNullLiteral(node);
			}
			throw new Error(`Unknown expression type: ${node.name} (${node.type.id})`);
	}
}

/**
 * Convert OrExpr - Lezer produces flat list, we need nested binary nodes
 * OrExpr = AndExpr (or AndExpr)*
 */
function convertOrExpr(node: SyntaxNode, source: string): ExprNode {
	const kids = allChildren(node);
	const operands: ExprNode[] = [];

	for (const kid of kids) {
		if (kid.type.id !== Terms.or) {
			operands.push(convertExpression(kid, source));
		}
	}

	if (operands.length === 1) {
		return operands[0]!;
	}

	// Fold into left-associative binary nodes
	let result = operands[0]!;
	for (let i = 1; i < operands.length; i++) {
		const right = operands[i]!;
		result = new LogicalNode("or", result, right, {
			start: result.span.start,
			end: right.span.end,
		});
	}
	return result;
}

/**
 * Convert AndExpr - same pattern as OrExpr
 */
function convertAndExpr(node: SyntaxNode, source: string): ExprNode {
	const kids = allChildren(node);
	const operands: ExprNode[] = [];

	for (const kid of kids) {
		if (kid.type.id !== Terms.and) {
			operands.push(convertExpression(kid, source));
		}
	}

	if (operands.length === 1) {
		return operands[0]!;
	}

	let result = operands[0]!;
	for (let i = 1; i < operands.length; i++) {
		const right = operands[i]!;
		result = new LogicalNode("and", result, right, {
			start: result.span.start,
			end: right.span.end,
		});
	}
	return result;
}

/**
 * Convert NotExpr - handles both "not" and "!" prefix
 */
function convertNotExpr(node: SyntaxNode, source: string): ExprNode {
	const kids = allChildren(node);
	
	// Check if this starts with "not" or "!"
	let hasNot = false;
	let operandNode: SyntaxNode | null = null;
	
	for (const kid of kids) {
		if (kid.type.id === Terms.not || kid.name === "!") {
			hasNot = true;
		} else {
			operandNode = kid;
		}
	}

	if (!operandNode) throw new Error("Missing operand in not expression");
	
	const operand = convertExpression(operandNode, source);
	
	if (hasNot) {
		return new UnaryNotNode(operand, span(node));
	}
	
	return operand;
}

/**
 * Convert CompareExpr - handles comparison operators and "in" expressions
 */
function convertCompareExpr(node: SyntaxNode, source: string): ExprNode {
	const kids = allChildren(node);
	
	// Find all parts: operands and operator
	const operands: ExprNode[] = [];
	let operator: string | null = null;
	let inExpr: SyntaxNode | null = null;
	
	for (const kid of kids) {
		if (kid.type.id === Terms.InExpr) {
			inExpr = kid;
		} else if (isCompareOp(kid.name)) {
			operator = kid.name;
		} else if (isExpressionNode(kid)) {
			operands.push(convertExpression(kid, source));
		}
	}

	// Handle "in" expression
	if (inExpr) {
		return convertInExpr(operands[0]!, inExpr, source);
	}

	// Simple expression without comparison
	if (!operator) {
		if (operands.length === 1) {
			return operands[0]!;
		}
		throw new Error("CompareExpr without operator must have single operand");
	}

	// Comparison expression
	if (operands.length !== 2) {
		throw new Error(`CompareExpr requires 2 operands, got ${operands.length}`);
	}

	return new CompareNode(
		operator as CompareOp,
		operands[0]!,
		operands[1]!,
		span(node)
	);
}

/**
 * Convert InExpr - handles both "in collection" and "in lower..upper"
 */
function convertInExpr(value: ExprNode, node: SyntaxNode, source: string): ExprNode {
	const kids = allChildren(node);
	let collection: ExprNode | null = null;
	let rangeExpr: SyntaxNode | null = null;

	for (const kid of kids) {
		if (kid.type.id === Terms.RangeExpr) {
			rangeExpr = kid;
		} else if (kid.type.id !== Terms._in && isExpressionNode(kid)) {
			collection = convertExpression(kid, source);
		}
	}

	if (!collection) throw new Error("Missing collection in 'in' expression");

	// Range expression: value in lower..upper
	if (rangeExpr) {
		const rangeKids = allChildren(rangeExpr);
		let upper: ExprNode | null = null;
		for (const kid of rangeKids) {
			if (isExpressionNode(kid)) {
				upper = convertExpression(kid, source);
			}
		}
		if (!upper) throw new Error("Missing upper bound in range expression");
		return new RangeNode(value, collection, upper, {
			start: value.span.start,
			end: upper.span.end,
		});
	}

	// Simple in: value in collection
	return new InNode(value, collection, {
		start: value.span.start,
		end: collection.span.end,
	});
}

function isCompareOp(op: string): boolean {
	return ["=", "!=", "<", ">", "<=", ">=", "=?", "!=?"].includes(op);
}

/**
 * Convert ArithExpr - handles + and - operators
 */
function convertArithExpr(node: SyntaxNode, source: string): ExprNode {
	const kids = allChildren(node);
	const parts: Array<{type: "operand"; node: ExprNode} | {type: "op"; op: "+" | "-"}> = [];

	for (const kid of kids) {
		if (kid.name === "+") {
			parts.push({type: "op", op: "+"});
		} else if (kid.name === "-") {
			parts.push({type: "op", op: "-"});
		} else if (isExpressionNode(kid)) {
			parts.push({type: "operand", node: convertExpression(kid, source)});
		}
	}

	// Single operand, no arithmetic
	if (parts.length === 1 && parts[0]?.type === "operand") {
		return parts[0].node;
	}

	// Build left-associative tree
	let result: ExprNode | null = null;
	let pendingOp: "+" | "-" | null = null;

	for (const part of parts) {
		if (part.type === "operand") {
			if (result === null) {
				result = part.node;
			} else if (pendingOp) {
				result = new ArithNode(pendingOp, result, part.node, {
					start: result.span.start,
					end: part.node.span.end,
				});
				pendingOp = null;
			}
		} else {
			pendingOp = part.op;
		}
	}

	if (!result) throw new Error("Empty ArithExpr");
	return result;
}

function convertParenExpr(node: SyntaxNode, source: string): ExprNode {
	const kids = allChildren(node);
	for (const kid of kids) {
		if (isExpressionNode(kid)) {
			return convertExpression(kid, source);
		}
	}
	throw new Error("Empty parenthesized expression");
}

function convertFunctionCall(node: SyntaxNode, source: string): ExprNode {
	// FunctionCall now has FunctionName child which contains Identifier or keyword
	const funcNameNode = child(node, Terms.FunctionName);
	if (!funcNameNode) throw new Error("Missing function name");
	// Get the actual name from inside FunctionName (could be Identifier or keyword like 'all', 'group')
	const name = text(funcNameNode, source);

	// Check if this is an aggregate function
	if (isAggregateFunction(name)) {
		return convertAggregateCall(node, name as AggregateFunc, source);
	}

	const argList = child(node, Terms.ArgList);
	const args: ExprNode[] = [];
	
	if (argList) {
		const argKids = allChildren(argList);
		for (const kid of argKids) {
			if (isExpressionNode(kid)) {
				args.push(convertExpression(kid, source));
			}
		}
	}

	// Look up the function in the registry
	const FuncClass = getFunctionClass(name);
	if (!FuncClass) {
		// Unknown function - throw parse error
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
	
	// Create the specific function node
	return new FuncClass(args, span(node));
}

/**
 * Convert InlineQuery node: @(from ... [prune ...] [where ...] [sort ...])
 */
function convertInlineQuery(node: SyntaxNode, source: string): InlineQueryNode {
	// InlineQuery contains InlineQueryBody which has From, optional Prune, Where, Sort
	const bodyNode = child(node, Terms.InlineQueryBody);
	if (!bodyNode) throw new Error("Missing inline query body");

	const fromNode = child(bodyNode, Terms.From);
	const pruneNode = child(bodyNode, Terms.Prune);
	const whereNode = child(bodyNode, Terms.Where);
	const sortNode = child(bodyNode, Terms.Sort);

	if (!fromNode) throw new Error("Inline query requires FROM clause");

	const from = convertFromClause(fromNode, source);
	const prune = pruneNode ? convertPruneClause(pruneNode, source) : undefined;
	const where = whereNode ? convertWhereClause(whereNode, source) : undefined;
	const sort = sortNode ? convertSortClause(sortNode, source) : undefined;

	return new InlineQueryNode(from, span(node), prune, where, sort);
}

function isAggregateFunction(name: string): boolean {
	return ["count", "sum", "avg", "min", "max", "any", "all"].includes(name.toLowerCase());
}

function convertAggregateCall(node: SyntaxNode, func: AggregateFunc, source: string): AggregateNode {
	const argList = child(node, Terms.ArgList);
	if (!argList) {
		throw new Error(`${func}() requires arguments`);
	}

	// Find first expression argument (the source)
	const firstArgExpr = findFirstExpressionInArgList(argList);
	if (!firstArgExpr) {
		throw new Error(`${func}() requires a source argument`);
	}

	// Unwrap expression wrappers to find the actual source node
	const firstArgNode = unwrapExpression(firstArgExpr);

	let source_: AggregateSource;
	let remainingArgsStart: SyntaxNode | null = null;

	// Handle different source types
	if (firstArgNode.type.id === Terms.InlineQuery) {
		// @(from ...) - inline query
		const inlineQuery = convertInlineQuery(firstArgNode, source);
		source_ = {
			type: "inlineQuery",
			node: inlineQuery,
		} as InlineQuerySource;
		remainingArgsStart = findNextExpression(argList, firstArgExpr);
	} else if (firstArgNode.type.id === Terms.FunctionCall) {
		// Get function name from FunctionName node
		const funcNameNode = child(firstArgNode, Terms.FunctionName);
		if (funcNameNode && text(funcNameNode, source).toLowerCase() === "group") {
			// group(Name) - group reference
			const groupArgList = child(firstArgNode, Terms.ArgList);
			if (!groupArgList) {
				throw new Error("group() requires an argument");
			}
			const groupArgExpr = findFirstExpressionInArgList(groupArgList);
			if (!groupArgExpr) {
				throw new Error("group() requires an argument");
			}
			const groupArg = unwrapExpression(groupArgExpr);
			let name: string;
			if (groupArg.type.id === Terms.Identifier) {
				name = text(groupArg, source);
			} else if (groupArg.type.id === Terms.PropertyAccess) {
				// PropertyAccess contains identifiers
				const identNode = child(groupArg, Terms.Identifier);
				if (identNode) {
					name = text(identNode, source);
				} else {
					throw new Error("group() requires an identifier argument");
				}
			} else {
				throw new Error("group() requires an identifier argument, not a string");
			}
			source_ = {
				type: "groupRef",
				name,
				span: span(firstArgNode),
			} as GroupRefSource;
			remainingArgsStart = findNextExpression(argList, firstArgExpr);
		} else {
			// Other function call - not supported as source
			throw new Error(`Invalid source in ${func}(): expected @(...), group(...), or identifier`);
		}
	} else if (firstArgNode.type.id === Terms.PropertyAccess || firstArgNode.type.id === Terms.Identifier) {
		// Bare identifier - could be group name or relation name
		let name: string;
		if (firstArgNode.type.id === Terms.Identifier) {
			name = text(firstArgNode, source);
		} else {
			const propAccess = convertPropertyAccess(firstArgNode, source);
			name = propAccess.path.join(".");
		}
		source_ = {
			type: "bareIdentifier",
			name,
			span: span(firstArgNode),
		} as BareIdentifierSource;
		remainingArgsStart = findNextExpression(argList, firstArgExpr);
	} else {
		throw new Error(`Invalid source in ${func}(): expected @(...), group(...), or identifier`);
	}

	// Parse remaining arguments (property or condition)
	const needsProperty = ["sum", "avg", "min", "max"].includes(func);
	const needsCondition = ["any", "all"].includes(func);

	let property: ExprNode | undefined;
	let condition: ExprNode | undefined;

	if (remainingArgsStart) {
		const remainingArg = convertExpression(remainingArgsStart, source);
		if (needsProperty) {
			property = remainingArg;
		} else if (needsCondition) {
			condition = remainingArg;
		}
	}

	return new AggregateNode(func, source_, span(node), property, condition);
}

/**
 * Find the first expression node in an ArgList
 */
function findFirstExpressionInArgList(node: SyntaxNode): SyntaxNode | null {
	const kids = allChildren(node);
	for (const kid of kids) {
		if (isExpressionNode(kid)) {
			return kid;
		}
	}
	return null;
}

/**
 * Unwrap expression wrappers (OrExpr, AndExpr, etc.) to find the atomic expression
 * Used for aggregate source detection where we need the actual node type
 */
function unwrapExpression(node: SyntaxNode): SyntaxNode {
	// Keep unwrapping expression wrappers until we hit an atomic expression
	const wrapperTypes = [
		Terms.OrExpr,
		Terms.AndExpr,
		Terms.NotExpr,
		Terms.CompareExpr,
		Terms.ArithExpr,
	];

	let current = node;
	while (wrapperTypes.includes(current.type.id)) {
		const kids = allChildren(current);
		// Find the first child that is an expression
		const exprChild = kids.find((k) => isExpressionNode(k));
		if (!exprChild) break;
		current = exprChild;
	}
	return current;
}

/**
 * Find the next expression after a given node in an ArgList
 */
function findNextExpression(argList: SyntaxNode, after: SyntaxNode): SyntaxNode | null {
	const kids = allChildren(argList);
	let foundAfter = false;
	for (const kid of kids) {
		if (foundAfter) {
			if (isExpressionNode(kid)) {
				return kid;
			}
		}
		if (kid === after || (kid.from === after.from && kid.to === after.to)) {
			foundAfter = true;
		}
	}
	return null;
}

function convertPropertyAccess(node: SyntaxNode, source: string): PropertyNode {
	const identifiers = children(node, Terms.Identifier);
	const path = identifiers.map((id) => text(id, source));
	return new PropertyNode(path, span(node), false);
}

function convertBuiltinPropertyAccess(node: SyntaxNode, source: string): PropertyNode {
	const fullText = text(node, source);
	// Remove $ prefix and split by dot
	const path = fullText.slice(1).split(".");
	return new PropertyNode(path, span(node), true);
}

// ============================================================================
// Literal Conversion
// ============================================================================

function convertSimpleLiteral(node: SyntaxNode, source: string): ExprNode {
	const kids = allChildren(node);
	if (kids.length === 0) throw new Error("Empty SimpleLiteral");
	
	const kid = kids[0]!;
	return convertExpression(kid, source);
}

function convertStringLiteral(node: SyntaxNode, source: string): StringNode {
	const value = parseStringLiteral(text(node, source));
	return new StringNode(value, span(node));
}

function convertNumberLiteral(node: SyntaxNode, source: string): NumberNode {
	const value = parseFloat(text(node, source));
	return new NumberNode(value, span(node));
}

function convertDurationLiteral(node: SyntaxNode, source: string): DurationNode {
	const t = text(node, source);
	const match = t.match(/^(\d+(?:\.\d+)?)([dwmy])$/);
	if (!match || !match[1] || !match[2]) {
		throw new Error(`Invalid duration: ${t}`);
	}
	return new DurationNode(
		parseFloat(match[1]),
		match[2] as DurationUnit,
		span(node)
	);
}

function convertBooleanLiteral(node: SyntaxNode, source: string): BooleanNode {
	const value = text(node, source).toLowerCase() === "true";
	return new BooleanNode(value, span(node));
}

function convertNullLiteral(node: SyntaxNode): NullNode {
	return new NullNode(span(node));
}

function convertDateExpr(node: SyntaxNode, source: string): DateExprNode {
	const baseNode = child(node, Terms.DateBase);
	const offsetNode = child(node, Terms.DateOffset);
	
	if (!baseNode) throw new Error("Missing date base");

	const base = convertDateBase(baseNode, source);
	const offset = offsetNode ? convertDateOffset(offsetNode, source) : undefined;

	return new DateExprNode(base, span(node), offset);
}

function convertDateBase(node: SyntaxNode, source: string): DateBase {
	const dateLiteral = child(node, Terms.DateLiteral);
	const relativeDate = child(node, Terms.RelativeDate);

	if (dateLiteral) {
		const dateStr = text(dateLiteral, source);
		const date = new Date(dateStr);
		return {
			type: "dateLiteral",
			value: date,
			span: span(dateLiteral),
		};
	}

	if (relativeDate) {
		const kind = convertRelativeDateKind(relativeDate);
		return {
			type: "relativeDate",
			kind,
			span: span(relativeDate),
		};
	}

	throw new Error("Invalid date base");
}

function convertRelativeDateKind(node: SyntaxNode): RelativeDateKind {
	const kids = allChildren(node);
	if (kids.length === 0) {
		// Check node name for keyword nodes
		switch (node.type.id) {
			case Terms.today:
				return "today";
			case Terms.yesterday:
				return "yesterday";
			case Terms.tomorrow:
				return "tomorrow";
			case Terms.startOfWeek:
				return "startOfWeek";
			case Terms.endOfWeek:
				return "endOfWeek";
		}
	}
	
	const kid = kids[0];
	if (kid) {
		switch (kid.type.id) {
			case Terms.today:
				return "today";
			case Terms.yesterday:
				return "yesterday";
			case Terms.tomorrow:
				return "tomorrow";
			case Terms.startOfWeek:
				return "startOfWeek";
			case Terms.endOfWeek:
				return "endOfWeek";
		}
	}
	
	return "today";
}

function convertDateOffset(node: SyntaxNode, source: string): DateOffset {
	const kids = allChildren(node);
	let op: "+" | "-" = "+";
	let duration: DurationNode | null = null;

	for (const kid of kids) {
		if (kid.name === "+") {
			op = "+";
		} else if (kid.name === "-") {
			op = "-";
		} else if (kid.type.id === Terms.Duration) {
			duration = convertDurationLiteral(kid, source);
		}
	}

	if (!duration) throw new Error("Missing duration in date offset");

	return {
		op,
		value: duration.value,
		unit: duration.unit,
	};
}

// ============================================================================
// String Parsing
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
