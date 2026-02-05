/**
 * date(string) - Parse string to date
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("DateNode", {function: "date"})
export class DateFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "date",
		description: "Parse string to date.",
		syntax: "date(string)",
		returnType: "date",
		examples: ['date("2024-01-15")', "date(created_string)"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const str = toString(args[0] ?? null);
		const date = new Date(str);
		return isNaN(date.getTime()) ? null : date;
	}
}
