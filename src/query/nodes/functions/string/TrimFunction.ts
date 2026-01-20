/**
 * trim(str) - Remove leading/trailing whitespace
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("TrimNode", {function: "trim"})
export class TrimFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "trim",
		description: "Remove leading and trailing whitespace.",
		syntax: "trim(string)",
		returnType: "string",
		examples: ["trim(title)"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		return toString(args[0] ?? null).trim();
	}
}
