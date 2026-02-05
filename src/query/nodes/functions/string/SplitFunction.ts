/**
 * split(str, delimiter) - Split string into array
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("SplitNode", {function: "split"})
export class SplitFunction extends FunctionExprNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "split",
		description: "Split string into array by delimiter.",
		syntax: "split(string, delimiter)",
		returnType: "array",
		examples: ['split(path, "/")', 'split(tags_string, ",")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const str = toString(args[0] ?? null);
		const delimiter = toString(args[1] ?? null);
		return str.split(delimiter);
	}
}
