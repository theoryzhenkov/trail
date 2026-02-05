/**
 * month(date) - Get month from date (1-12)
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("MonthNode", {function: "month"})
export class MonthFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "month",
		description: "Get month from date (1-12).",
		syntax: "month(date)",
		returnType: "number",
		examples: ["month(due) = 6"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getMonth() + 1; // JavaScript months are 0-indexed
		}
		return null;
	}
}
