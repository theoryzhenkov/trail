/**
 * first(array) - Get first element
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("FirstNode", {function: "first"})
export class FirstFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "first",
		description: "Get first element of array.",
		syntax: "first(array)",
		returnType: "any",
		examples: ['first(tags) = "important"'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		if (Array.isArray(value) && value.length > 0) {
			return value[0] ?? null;
		}
		return null;
	}
}
