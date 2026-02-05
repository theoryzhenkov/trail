/**
 * endsWith(str, suffix) - Check if string ends with suffix
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("EndsWithNode", {function: "endsWith"})
export class EndsWithFunction extends FunctionExprNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "endsWith",
		description: "Check if string ends with suffix.",
		syntax: "endsWith(string, suffix)",
		returnType: "boolean",
		examples: ['endsWith(file.name, "2024")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const str = toString(args[0] ?? null);
		const suffix = toString(args[1] ?? null);
		return str.endsWith(suffix);
	}
}
