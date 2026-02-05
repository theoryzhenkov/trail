/**
 * hours(date) - Get hours from date
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("HoursNode", {function: "hours"})
export class HoursFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "hours",
		description: "Get hours from date (0-23).",
		syntax: "hours(date)",
		returnType: "number",
		examples: ["hours(file.modified) < 12  // morning"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getHours();
		}
		return null;
	}
}
