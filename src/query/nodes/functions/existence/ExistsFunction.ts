/**
 * exists(value) - Check if value is not null
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("ExistsNode", {function: "exists"})
export class ExistsFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "exists",
		description: "Check if value is not null/undefined.",
		syntax: "exists(value)",
		returnType: "boolean",
		examples: ["exists(due)", "exists(priority)"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0];
		return value !== null && value !== undefined;
	}
}
