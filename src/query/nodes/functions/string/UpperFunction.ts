/**
 * upper(str) - Convert to uppercase
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("UpperNode", {function: "upper"})
export class UpperFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "upper",
		description: "Convert string to uppercase.",
		syntax: "upper(string)",
		returnType: "string",
		examples: ['upper(type) = "PROJECT"'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		return toString(args[0] ?? null).toUpperCase();
	}
}
