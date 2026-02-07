/**
 * InExprNode - Membership check expression
 */

import type {SyntaxNode} from "@lezer/common";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import type {EvalContext} from "../context";
import {register, type ConvertContext} from "../registry";
import {equals} from "../value-ops";
import {RangeNode} from "./RangeNode";

@register("InExprNode", {expr: true})
export class InExprNode extends ExprNode {
	readonly value: ExprNode;
	readonly collection: ExprNode;

	static providesContexts: CompletionContext[] = ["after-expression"];

	static documentation: NodeDoc = {
		title: "IN operator",
		description: "Checks membership in array, substring in string, or value in range.",
		syntax: "Value in Collection | Value in Lower..Upper",
		examples: ['"tag" in tags', '"sub" in title', "priority in 1..5", "date in 2024-01-01..today"],
	};

	static highlighting = "operatorKeyword" as const;

	static completable: Completable = {
		keywords: ["in"],
		context: "after-expression",
		priority: 85,
		category: "operator",
	};

	constructor(value: ExprNode, collection: ExprNode, span: Span) {
		super(span);
		this.value = value;
		this.collection = collection;
	}

	evaluate(ctx: EvalContext): Value {
		const value = this.value.evaluate(ctx);
		const collection = this.collection.evaluate(ctx);

		if (collection === null) {
			return false;
		}

		// Array membership
		if (Array.isArray(collection)) {
			return collection.some((item) => equals(value, item));
		}

		// String substring
		if (typeof collection === "string" && typeof value === "string") {
			return collection.includes(value);
		}

		return false;
	}

	validate(ctx: ValidationContext): void {
		this.value.validate(ctx);
		this.collection.validate(ctx);
	}

	/**
	 * Convert InExpr node - handles both "in collection" and "in lower..upper"
	 * Called from CompareExprNode.fromSyntax when an InExpr child is found.
	 */
	static fromInSyntax(value: ExprNode, node: SyntaxNode, ctx: ConvertContext): ExprNode {
		const kids = ctx.allChildren(node);
		let collection: ExprNode | null = null;
		let rangeExpr: SyntaxNode | null = null;

		for (const kid of kids) {
			if (kid.name === "RangeExpr") {
				rangeExpr = kid;
			} else if (kid.name !== "in" && ctx.isExpr(kid)) {
				collection = ctx.expr(kid);
			}
		}

		if (!collection) throw new Error("Missing collection in 'in' expression");

		// Range expression: value in lower..upper
		if (rangeExpr) {
			const rangeKids = ctx.allChildren(rangeExpr);
			let upper: ExprNode | null = null;
			for (const kid of rangeKids) {
				if (ctx.isExpr(kid)) {
					upper = ctx.expr(kid);
				}
			}
			if (!upper) throw new Error("Missing upper bound in range expression");
			return new RangeNode(value, collection, upper, {
				start: value.span.start,
				end: upper.span.end,
			});
		}

		// Simple in: value in collection
		return new InExprNode(value, collection, {
			start: value.span.start,
			end: collection.span.end,
		});
	}
}
