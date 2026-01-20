/**
 * ifnull(value, default) - Return default if value is null
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("IfNullNode", {function: "ifnull"})
export class IfNullFunction extends FunctionExprNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "ifnull",
		description: "Return default value if first argument is null.",
		syntax: "ifnull(value, default)",
		returnType: "any",
		examples: ['ifnull(status, "unknown")', "ifnull(priority, 0)"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0];
		const defaultValue = args[1] ?? null;
		return value !== null && value !== undefined ? value : defaultValue;
	}
}
