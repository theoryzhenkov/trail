/**
 * isEmpty(array) - Check if array is empty
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("IsEmptyNode", {function: "isEmpty"})
export class IsEmptyFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "isEmpty",
		description: "Check if array is empty.",
		syntax: "isEmpty(array)",
		returnType: "boolean",
		examples: ["isEmpty(tags)", "not isEmpty(children)"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (value === null) return true;
		if (Array.isArray(value)) return value.length === 0;
		if (typeof value === "string") return value.length === 0;
		return true;
	}
}
