/**
 * InExprNode - Membership check expression
 */

import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import type {ExecutorContext} from "../context";
import {register} from "../registry";

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

	evaluate(ctx: ExecutorContext): Value {
		const value = this.value.evaluate(ctx);
		const collection = this.collection.evaluate(ctx);

		if (collection === null) {
			return false;
		}

		// Array membership
		if (Array.isArray(collection)) {
			return collection.some((item) => ctx.equals(value, item));
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
}
