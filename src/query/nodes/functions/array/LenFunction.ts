/**
 * len(array) - Get array length
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("LenNode", {function: "len"})
export class LenFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "len",
		description: "Get array length.",
		syntax: "len(array)",
		returnType: "number",
		examples: ["len(tags)", "len(children)"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (value === null) return 0;
		if (Array.isArray(value)) return value.length;
		if (typeof value === "string") return value.length;
		return 0;
	}
}
