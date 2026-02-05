/**
 * now() - Get current date and time
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("NowNode", {function: "now"})
export class NowFunction extends FunctionExprNode {
	static minArity = 0;
	static maxArity = 0;
	static documentation: NodeDoc = {
		title: "now",
		description: "Get current date and time.",
		syntax: "now()",
		returnType: "date",
		examples: ["file.modified > now() - 7d"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(_ctx: EvalContext): Value {
		return new Date();
	}
}
