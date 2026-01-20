/**
 * coalesce(value1, value2, ...) - Return first non-null value
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("CoalesceNode", {function: "coalesce"})
export class CoalesceFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = Infinity;
	static documentation: NodeDoc = {
		title: "coalesce",
		description: "Return first non-null value from arguments.",
		syntax: "coalesce(value1, value2, ...)",
		returnType: "any",
		examples: ["coalesce(alias, file.name)", "coalesce(due, created)"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		for (const arg of args) {
			if (arg !== null && arg !== undefined) {
				return arg;
			}
		}
		return null;
	}
}
