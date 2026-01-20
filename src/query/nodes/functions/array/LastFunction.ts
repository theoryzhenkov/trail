/**
 * last(array) - Get last element
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("LastNode", {function: "last"})
export class LastFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "last",
		description: "Get last element of array.",
		syntax: "last(array)",
		returnType: "any",
		examples: ["last(path_parts)"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (Array.isArray(value) && value.length > 0) {
			return value[value.length - 1] ?? null;
		}
		return null;
	}
}
