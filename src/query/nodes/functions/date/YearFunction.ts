/**
 * year(date) - Get year from date
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("YearNode", {function: "year"})
export class YearFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "year",
		description: "Get year from date.",
		syntax: "year(date)",
		returnType: "number",
		examples: ["year(file.created) = 2024"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getFullYear();
		}
		return null;
	}
}
