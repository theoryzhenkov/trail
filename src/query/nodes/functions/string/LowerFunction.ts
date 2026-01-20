/**
 * lower(str) - Convert to lowercase
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("LowerNode", {function: "lower"})
export class LowerFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "lower",
		description: "Convert string to lowercase.",
		syntax: "lower(string)",
		returnType: "string",
		examples: ['lower(status) = "active"'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		return toString(args[0] ?? null).toLowerCase();
	}
}
