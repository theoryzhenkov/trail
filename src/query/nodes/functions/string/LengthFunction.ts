/**
 * length(str) - Get string length
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("LengthNode", {function: "length"})
export class LengthFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "length",
		description: "Get string length. Also works on arrays.",
		syntax: "length(string)",
		returnType: "number",
		examples: ["length(title)", "length(tags)"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (value === null) return 0;
		if (typeof value === "string") return value.length;
		if (Array.isArray(value)) return value.length;
		return toString(value).length;
	}
}
