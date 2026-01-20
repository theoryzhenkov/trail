/**
 * RangeNode - Range check expression (value in lower..upper)
 */

import {ExprNode} from "../base/ExprNode";
import {register} from "../registry";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {ExecutorContext} from "../context";

@register("range", {expr: true})
export class RangeNode extends ExprNode {
	readonly value: ExprNode;
	readonly lower: ExprNode;
	readonly upper: ExprNode;

	static documentation: NodeDoc = {
		title: "Range Expression",
		description: "Checks if value is within a range (inclusive on both ends).",
		syntax: "value in lower..upper",
		examples: ["priority in 1..5", "date in startOfWeek..endOfWeek"],
	};

	static highlighting = "operator" as const;

	constructor(value: ExprNode, lower: ExprNode, upper: ExprNode, span: Span) {
		super(span);
		this.value = value;
		this.lower = lower;
		this.upper = upper;
	}

	evaluate(ctx: ExecutorContext): Value {
		const value = this.value.evaluate(ctx);
		const lower = this.lower.evaluate(ctx);
		const upper = this.upper.evaluate(ctx);

		if (value === null || lower === null || upper === null) {
			return null;
		}

		return ctx.compare(value, lower) >= 0 && ctx.compare(value, upper) <= 0;
	}

	validate(ctx: ValidationContext): void {
		this.value.validate(ctx);
		this.lower.validate(ctx);
		this.upper.validate(ctx);
	}
}
