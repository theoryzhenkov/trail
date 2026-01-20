/**
 * InNode - Membership check expression
 */

import {ExprNode} from "../base/ExprNode";
import {register} from "../registry";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {ExecutorContext} from "../context";

@register("in", {expr: true})
export class InNode extends ExprNode {
	readonly value: ExprNode;
	readonly collection: ExprNode;

	static documentation: NodeDoc = {
		title: "IN Operator",
		description: "Checks if value is in collection (array membership) or substring in string.",
		syntax: "value in collection",
		examples: ['"tag" in tags', '"sub" in title', '"work" in file.tags'],
	};

	static highlighting = "operatorKeyword" as const;

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
