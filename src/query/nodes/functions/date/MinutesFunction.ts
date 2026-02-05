/**
 * minutes(date) - Get minutes from date
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("MinutesNode", {function: "minutes"})
export class MinutesFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "minutes",
		description: "Get minutes from date (0-59).",
		syntax: "minutes(date)",
		returnType: "number",
		examples: ["minutes(time)"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getMinutes();
		}
		return null;
	}
}
