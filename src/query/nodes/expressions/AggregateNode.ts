/**
 * AggregateNode - Aggregate function expressions (count, sum, avg, min, max, any, all)
 */

import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {ExecutorContext} from "../context";

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
		description: "Computes aggregate values over traversal results. count, sum, avg, min, max operate on values; any, all test conditions.",
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
		// Aggregate evaluation is complex and requires executing subqueries.
		// For now, we'll delegate to the executor's aggregate handling.
		// This is a placeholder that shows the structure.
		
		// In a full implementation, this would:
		// 1. Execute the source subquery from the current file
		// 2. Collect all result nodes
		// 3. Compute the aggregate based on func type
		
		ctx.addError("Aggregate evaluation not yet implemented in node architecture", this.span);
		return null;
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
