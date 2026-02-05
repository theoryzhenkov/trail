/**
 * day(date) - Get day of month from date
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("DayNode", {function: "day"})
export class DayFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "day",
		description: "Get day of month from date.",
		syntax: "day(date)",
		returnType: "number",
		examples: ["day(due) = 15"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getDate();
		}
		return null;
	}
}
