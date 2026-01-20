/**
 * AggregateNode - Aggregate function expressions (count, sum, avg, min, max, any, all)
 */

import {ExprNode} from "../base/ExprNode";
import {PropertyNode} from "./PropertyNode";
import type {Span, Value, NodeDoc, ValidationContext, QueryResultNode} from "../types";
import type {ExecutorContext} from "../context";
import {traverse, type TraversalOptions} from "../execution/traversal";

export type AggregateFunc = "count" | "sum" | "avg" | "min" | "max" | "any" | "all";

/**
 * Source types for aggregate functions
 */
export interface GroupRefSource {
	type: "groupRef";
	name: string;
	span: Span;
}

export interface InlineFromSource {
	type: "inlineFrom";
	relations: RelationSpecData[];
	span: Span;
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
	flatten?: boolean;
	span: Span;
}

export type AggregateSource = GroupRefSource | InlineFromSource | BareIdentifierSource;

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
			"sum(from tasks, points)",
			'any(subtasks, status = "done")',
			'all(group("Tasks"), priority > 0)',
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

	evaluate(ctx: ExecutorContext): Value {
		// Execute subquery from current file
		const results = this.executeSubquery(ctx);

		// Flatten tree for aggregation
		const allNodes = this.flattenTree(results);

		// Compute aggregate based on function type
		switch (this.func) {
			case "count":
				return allNodes.length;

			case "sum":
				return this.computeSum(allNodes, ctx);

			case "avg":
				return this.computeAvg(allNodes, ctx);

			case "min":
				return this.computeMin(allNodes, ctx);

			case "max":
				return this.computeMax(allNodes, ctx);

			case "any":
				return this.computeAny(allNodes, ctx);

			case "all":
				return this.computeAll(allNodes, ctx);
		}
	}

	private executeSubquery(ctx: ExecutorContext): QueryResultNode[] {
		const fromPath = ctx.filePath;
		const relations = this.resolveSourceRelations(ctx);
		const results: QueryResultNode[] = [];

		for (const rel of relations) {
			const options: TraversalOptions = {
				startPath: fromPath,
				relation: rel.name,
				maxDepth: rel.depth === "unlimited" ? Infinity : rel.depth,
				extendGroup: rel.extend,
				flatten: rel.flatten,
			};

			const result = traverse(ctx, options);
			results.push(...result.nodes);
		}

		return results;
	}

	private resolveSourceRelations(
		ctx: ExecutorContext
	): Array<{name: string; depth: number | "unlimited"; extend?: string; flatten?: boolean}> {
		if (this.source.type === "groupRef") {
			// Explicit group reference
			const groupQuery = ctx.resolveGroupQuery(this.source.name) as
				| {from: {relations: Array<{name: string; depth: number | "unlimited"; extend?: string; flatten?: boolean}>}}
				| undefined;
			return groupQuery?.from.relations ?? [];
		} else if (this.source.type === "inlineFrom") {
			// Explicit from clause
			return this.source.relations;
		} else {
			// Bare identifier - resolve to group or relation
			const groupQuery = ctx.resolveGroupQuery(this.source.name) as
				| {from: {relations: Array<{name: string; depth: number | "unlimited"; extend?: string; flatten?: boolean}>}}
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

	private computeSum(nodes: QueryResultNode[], ctx: ExecutorContext): number {
		let sum = 0;
		for (const node of nodes) {
			const val = this.getPropertyValue(node, ctx);
			if (typeof val === "number") {
				sum += val;
			}
		}
		return sum;
	}

	private computeAvg(nodes: QueryResultNode[], ctx: ExecutorContext): number | null {
		let sum = 0;
		let count = 0;
		for (const node of nodes) {
			const val = this.getPropertyValue(node, ctx);
			if (typeof val === "number") {
				sum += val;
				count++;
			}
		}
		return count > 0 ? sum / count : null;
	}

	private computeMin(nodes: QueryResultNode[], ctx: ExecutorContext): Value {
		let min: Value = null;
		for (const node of nodes) {
			const val = this.getPropertyValue(node, ctx);
			if (val === null) continue;
			if (min === null || ctx.compare(val, min) < 0) {
				min = val;
			}
		}
		return min;
	}

	private computeMax(nodes: QueryResultNode[], ctx: ExecutorContext): Value {
		let max: Value = null;
		for (const node of nodes) {
			const val = this.getPropertyValue(node, ctx);
			if (val === null) continue;
			if (max === null || ctx.compare(val, max) > 0) {
				max = val;
			}
		}
		return max;
	}

	private computeAny(nodes: QueryResultNode[], ctx: ExecutorContext): boolean {
		for (const node of nodes) {
			ctx.setCurrentFile(node.path, node.properties);
			ctx.setTraversal({
				depth: node.depth,
				relation: node.relation,
				isImplied: node.implied,
				parent: node.parent,
				path: node.traversalPath,
			});
			const result = this.condition!.evaluate(ctx);
			if (ctx.isTruthy(result)) {
				return true;
			}
		}
		return false;
	}

	private computeAll(nodes: QueryResultNode[], ctx: ExecutorContext): boolean {
		if (nodes.length === 0) {
			return true; // vacuously true
		}
		for (const node of nodes) {
			ctx.setCurrentFile(node.path, node.properties);
			ctx.setTraversal({
				depth: node.depth,
				relation: node.relation,
				isImplied: node.implied,
				parent: node.parent,
				path: node.traversalPath,
			});
			const result = this.condition!.evaluate(ctx);
			if (!ctx.isTruthy(result)) {
				return false;
			}
		}
		return true;
	}

	private getPropertyValue(node: QueryResultNode, ctx: ExecutorContext): Value {
		if (!this.property) return null;

		// Set context to this node
		ctx.setCurrentFile(node.path, node.properties);
		ctx.setTraversal({
			depth: node.depth,
			relation: node.relation,
			isImplied: node.implied,
			parent: node.parent,
			path: node.traversalPath,
		});

		// If property is a PropertyNode, use the simple path access
		if (this.property instanceof PropertyNode) {
			return ctx.getPropertyValue(this.property.path.join("."));
		}

		// Otherwise evaluate the expression
		return this.property.evaluate(ctx);
	}

	validate(ctx: ValidationContext): void {
		// Validate source
		if (this.source.type === "groupRef") {
			if (!ctx.hasGroup(this.source.name)) {
				ctx.addError(`Unknown group: ${this.source.name}`, this.source.span, "UNKNOWN_GROUP");
			}
		} else if (this.source.type === "inlineFrom") {
			for (const rel of this.source.relations) {
				if (!ctx.hasRelation(rel.name)) {
					ctx.addError(`Unknown relation: ${rel.name}`, rel.span, "UNKNOWN_RELATION");
				}
			}
		} else if (this.source.type === "bareIdentifier") {
			const name = this.source.name;
			const isGroup = ctx.hasGroup(name);
			const isRelation = ctx.hasRelation(name);

			if (isGroup && isRelation) {
				ctx.addError(
					`"${name}" is both a group and a relation. Use group("${name}") or \`from ${name}\` to disambiguate.`,
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
}
