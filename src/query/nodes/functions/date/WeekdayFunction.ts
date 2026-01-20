/**
 * weekday(date) - Get day of week (0=Sun, 6=Sat)
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("WeekdayNode", {function: "weekday"})
export class WeekdayFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "weekday",
		description: "Get day of week (0=Sunday, 6=Saturday).",
		syntax: "weekday(date)",
		returnType: "number",
		examples: ["weekday(due) = 1  // Monday"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getDay();
		}
		return null;
	}
}
