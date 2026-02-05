/**
 * startsWith(str, prefix) - Check if string starts with prefix
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("StartsWithNode", {function: "startsWith"})
export class StartsWithFunction extends FunctionExprNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "startsWith",
		description: "Check if string starts with prefix.",
		syntax: "startsWith(string, prefix)",
		returnType: "boolean",
		examples: ['startsWith(file.name, "2024")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const str = toString(args[0] ?? null);
		const prefix = toString(args[1] ?? null);
		return str.startsWith(prefix);
	}
}
