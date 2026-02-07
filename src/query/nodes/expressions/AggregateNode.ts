/**
 * AggregateNode - Aggregate function expressions (count, sum, avg, min, max, any, all)
 */

import type {SyntaxNode} from "@lezer/common";
import {ExprNode} from "../base/ExprNode";
import {PropertyNode} from "./PropertyNode";
import {InlineQueryNode} from "./InlineQueryNode";
import type {Span, Value, NodeDoc, ValidationContext, QueryResultNode} from "../types";
import {type EvalContext, type QueryEnv, evalContextFromNode} from "../context";
import {traverse, INCLUDE_ALL, type TraversalConfig} from "../execution/traversal";
import {register, type ConvertContext} from "../registry";
import {compare, isTruthy} from "../value-ops";

export type AggregateFunc = "count" | "sum" | "avg" | "min" | "max" | "any" | "all";

/**
 * Source types for aggregate functions
 */
export interface GroupRefSource {
	type: "groupRef";
	name: string;
	span: Span;
}

export interface InlineQuerySource {
	type: "inlineQuery";
	node: InlineQueryNode;
}

export interface BareIdentifierSource {
	type: "bareIdentifier";
	name: string;
	span: Span;
}

export interface RelationSpecData {
	name: string;
	depth: number | "unlimited";
	extend?: string;
	flatten?: number | true;
	span: Span;
}

export type AggregateSource = GroupRefSource | InlineQuerySource | BareIdentifierSource;

@register("AggregateNode", {expr: true})
export class AggregateNode extends ExprNode {
	readonly func: AggregateFunc;
	readonly source: AggregateSource;
	readonly property?: ExprNode;
	readonly condition?: ExprNode;

	static documentation: NodeDoc = {
		title: "Aggregate Function",
		description:
			"Computes aggregate values over traversal results. count, sum, avg, min, max operate on values; any, all test conditions.",
		syntax: "func(source[, property|condition])",
		examples: [
			"count(children)",
			"sum(@(from tasks), points)",
			'any(@(from subtasks), status = "done")',
			'all(@"Tasks", priority > 0)',
		],
	};

	static highlighting = "function" as const;

	constructor(
		func: AggregateFunc,
		source: AggregateSource,
		span: Span,
		property?: ExprNode,
		condition?: ExprNode
	) {
		super(span);
		this.func = func;
		this.source = source;
		this.property = property;
		this.condition = condition;
	}

	evaluate(ctx: EvalContext): Value {
		const env = ctx.env;

		// Execute subquery from current file
		const results = this.executeSubquery(env, ctx.filePath);

		// Flatten tree for aggregation
		const allNodes = this.flattenTree(results);

		// Compute aggregate based on function type
		switch (this.func) {
			case "count":
				return allNodes.length;

			case "sum":
				return this.computeSum(allNodes, env);

			case "avg":
				return this.computeAvg(allNodes, env);

			case "min":
				return this.computeMin(allNodes, env);

			case "max":
				return this.computeMax(allNodes, env);

			case "any":
				return this.computeAny(allNodes, env);

			case "all":
				return this.computeAll(allNodes, env);
		}
	}

	private executeSubquery(env: QueryEnv, fromPath: string): QueryResultNode[] {
		// Handle InlineQueryNode source - delegate to its executeQuery
		if (this.source.type === "inlineQuery") {
			return this.source.node.executeQuery(env, fromPath);
		}

		const relations = this.resolveSourceRelations(env);
		const results: QueryResultNode[] = [];

		for (const rel of relations) {
			const config: TraversalConfig = {
				startPath: fromPath,
				relation: rel.name,
				maxDepth: rel.depth === "unlimited" ? Infinity : rel.depth,
				filter: INCLUDE_ALL,
				output: {
					flattenFrom: rel.flatten,
				},
			};

			const result = traverse(env, config);
			results.push(...result.nodes);
		}

		return results;
	}

	private resolveSourceRelations(
		env: QueryEnv
	): Array<{name: string; depth: number | "unlimited"; extend?: string; flatten?: number | true}> {
		if (this.source.type === "groupRef") {
			// Explicit group reference
			const groupQuery = env.resolveGroupQuery(this.source.name) as
				| {from: {relations: Array<{name: string; depth: number | "unlimited"; extend?: string; flatten?: number | true}>}}
				| undefined;
			return groupQuery?.from.relations ?? [];
		} else if (this.source.type === "bareIdentifier") {
			// Bare identifier - resolve to group or relation
			const groupQuery = env.resolveGroupQuery(this.source.name) as
				| {from: {relations: Array<{name: string; depth: number | "unlimited"; extend?: string; flatten?: number | true}>}}
				| undefined;
			if (groupQuery) {
				return groupQuery.from.relations;
			} else {
				// Treat as relation with unlimited depth
				return [
					{
						name: this.source.name,
						depth: "unlimited" as const,
					},
				];
			}
		} else {
			// inlineQuery - should not reach here as it's handled in executeSubquery
			return [];
		}
	}

	private flattenTree(nodes: QueryResultNode[]): QueryResultNode[] {
		const result: QueryResultNode[] = [];
		for (const node of nodes) {
			result.push(node);
			result.push(...this.flattenTree(node.children));
		}
		return result;
	}

	private computeSum(nodes: QueryResultNode[], env: QueryEnv): number {
		let sum = 0;
		for (const node of nodes) {
			const val = this.getPropertyValue(node, env);
			if (typeof val === "number") {
				sum += val;
			}
		}
		return sum;
	}

	private computeAvg(nodes: QueryResultNode[], env: QueryEnv): number | null {
		let sum = 0;
		let count = 0;
		for (const node of nodes) {
			const val = this.getPropertyValue(node, env);
			if (typeof val === "number") {
				sum += val;
				count++;
			}
		}
		return count > 0 ? sum / count : null;
	}

	private computeMin(nodes: QueryResultNode[], env: QueryEnv): Value {
		let min: Value = null;
		for (const node of nodes) {
			const val = this.getPropertyValue(node, env);
			if (val === null) continue;
			if (min === null || compare(val, min) < 0) {
				min = val;
			}
		}
		return min;
	}

	private computeMax(nodes: QueryResultNode[], env: QueryEnv): Value {
		let max: Value = null;
		for (const node of nodes) {
			const val = this.getPropertyValue(node, env);
			if (val === null) continue;
			if (max === null || compare(val, max) > 0) {
				max = val;
			}
		}
		return max;
	}

	private computeAny(nodes: QueryResultNode[], env: QueryEnv): boolean {
		for (const node of nodes) {
			const nodeCtx = evalContextFromNode(env, node);
			const result = this.condition!.evaluate(nodeCtx);
			if (isTruthy(result)) {
				return true;
			}
		}
		return false;
	}

	private computeAll(nodes: QueryResultNode[], env: QueryEnv): boolean {
		if (nodes.length === 0) {
			return true; // vacuously true
		}
		for (const node of nodes) {
			const nodeCtx = evalContextFromNode(env, node);
			const result = this.condition!.evaluate(nodeCtx);
			if (!isTruthy(result)) {
				return false;
			}
		}
		return true;
	}

	private getPropertyValue(node: QueryResultNode, env: QueryEnv): Value {
		if (!this.property) return null;

		const nodeCtx = evalContextFromNode(env, node);

		// If property is a PropertyNode, use the simple path access
		if (this.property instanceof PropertyNode) {
			return nodeCtx.getPropertyValue(this.property.path.join("."));
		}

		// Otherwise evaluate the expression
		return this.property.evaluate(nodeCtx);
	}

	validate(ctx: ValidationContext): void {
		// Validate source
		if (this.source.type === "groupRef") {
			if (!ctx.hasGroup(this.source.name)) {
				ctx.addError(`Unknown group: ${this.source.name}`, this.source.span, "UNKNOWN_GROUP");
			}
		} else if (this.source.type === "inlineQuery") {
			// Delegate validation to the inline query node
			this.source.node.validate(ctx);
		} else if (this.source.type === "bareIdentifier") {
			const name = this.source.name;
			const isGroup = ctx.hasGroup(name);
			const isRelation = ctx.hasRelation(name);

			if (isGroup && isRelation) {
				ctx.addError(
					`"${name}" is both a group and a relation. Use @"${name}" or @(from ${name}) to disambiguate.`,
					this.source.span,
					"AMBIGUOUS_IDENTIFIER"
				);
			} else if (!isGroup && !isRelation) {
				ctx.addError(`Unknown group or relation: ${name}`, this.source.span, "UNKNOWN_IDENTIFIER");
			}
		}

		// Validate property/condition
		if (this.property) {
			this.property.validate(ctx);
		}
		if (this.condition) {
			this.condition.validate(ctx);
		}

		// Check function-specific requirements
		const needsProperty = ["sum", "avg", "min", "max"].includes(this.func);
		const needsCondition = ["any", "all"].includes(this.func);

		if (needsProperty && !this.property) {
			ctx.addError(`${this.func}() requires a property argument`, this.span, "INVALID_ARITY");
		}
		if (needsCondition && !this.condition) {
			ctx.addError(`${this.func}() requires a condition argument`, this.span, "INVALID_ARITY");
		}
	}

	/**
	 * Check if a function name is an aggregate function
	 */
	static isAggregate(name: string): boolean {
		return AGGREGATE_NAMES.has(name.toLowerCase());
	}

	/**
	 * Convert a FunctionCall syntax node into an AggregateNode.
	 * Called from the FunctionCall structural converter when the function name is an aggregate.
	 */
	static fromSyntax(node: SyntaxNode, func: AggregateFunc, ctx: ConvertContext): AggregateNode {
		const argList = node.getChild("ArgList");
		if (!argList) throw new Error(`${func}() requires arguments`);

		// Find first expression argument (the source)
		const firstArgExpr = findFirstExpression(argList, ctx);
		if (!firstArgExpr) throw new Error(`${func}() requires a source argument`);

		// Unwrap expression wrappers to find the actual source node
		const firstArgNode = unwrapExpression(firstArgExpr, ctx);

		let source_: AggregateSource;
		let remainingArgsStart: SyntaxNode | null = null;

		if (firstArgNode.name === "InlineQuery") {
			const inlineQuery = InlineQueryNode.fromSyntax(firstArgNode, ctx);
			source_ = {type: "inlineQuery", node: inlineQuery} as InlineQuerySource;
			remainingArgsStart = findNextExpression(argList, firstArgExpr, ctx);
		} else if (firstArgNode.name === "GroupReference") {
			const stringNode = firstArgNode.getChild("String");
			if (!stringNode) throw new Error("Missing string in group reference");
			const groupName = ctx.parseString(ctx.text(stringNode));
			source_ = {type: "groupRef", name: groupName, span: ctx.span(firstArgNode)} as GroupRefSource;
			remainingArgsStart = findNextExpression(argList, firstArgExpr, ctx);
		} else if (firstArgNode.name === "PropertyAccess" || firstArgNode.name === "Identifier") {
			let name: string;
			if (firstArgNode.name === "Identifier") {
				name = ctx.text(firstArgNode);
			} else {
				const propAccess = PropertyNode.fromSyntax(firstArgNode, ctx);
				name = propAccess.path.join(".");
			}
			source_ = {type: "bareIdentifier", name, span: ctx.span(firstArgNode)} as BareIdentifierSource;
			remainingArgsStart = findNextExpression(argList, firstArgExpr, ctx);
		} else {
			throw new Error(`Invalid source in ${func}(): expected @(...), @"Name", or identifier`);
		}

		// Parse remaining arguments (property or condition)
		const needsProperty = ["sum", "avg", "min", "max"].includes(func);
		const needsCondition = ["any", "all"].includes(func);
		let property: ExprNode | undefined;
		let condition: ExprNode | undefined;

		if (remainingArgsStart) {
			const remainingArg = ctx.expr(remainingArgsStart);
			if (needsProperty) {
				property = remainingArg;
			} else if (needsCondition) {
				condition = remainingArg;
			}
		}

		return new AggregateNode(func, source_, ctx.span(node), property, condition);
	}
}

const AGGREGATE_NAMES = new Set(["count", "sum", "avg", "min", "max", "any", "all"]);

/** Unwrap expression wrappers to find the atomic expression */
function unwrapExpression(node: SyntaxNode, ctx: ConvertContext): SyntaxNode {
	const wrapperNames = new Set(["OrExpr", "AndExpr", "NotExpr", "CompareExpr", "ArithExpr"]);
	let current = node;
	while (wrapperNames.has(current.name)) {
		const kids = ctx.allChildren(current);
		const exprChild = kids.find((k) => ctx.isExpr(k));
		if (!exprChild) break;
		current = exprChild;
	}
	return current;
}

/** Find the first expression node in an ArgList */
function findFirstExpression(argList: SyntaxNode, ctx: ConvertContext): SyntaxNode | null {
	const kids = ctx.allChildren(argList);
	for (const kid of kids) {
		if (ctx.isExpr(kid)) return kid;
	}
	return null;
}

/** Find the next expression after a given node in an ArgList */
function findNextExpression(argList: SyntaxNode, after: SyntaxNode, ctx: ConvertContext): SyntaxNode | null {
	const kids = ctx.allChildren(argList);
	let foundAfter = false;
	for (const kid of kids) {
		if (foundAfter) {
			if (ctx.isExpr(kid)) return kid;
		}
		if (kid === after || (kid.from === after.from && kid.to === after.to)) {
			foundAfter = true;
		}
	}
	return null;
}
