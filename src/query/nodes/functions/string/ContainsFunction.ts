/**
 * contains(haystack, needle) - Check if string contains substring
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("ContainsNode", {function: "contains"})
export class ContainsFunction extends FunctionExprNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "contains",
		description: "Check if string contains substring (case-sensitive).",
		syntax: "contains(haystack, needle)",
		returnType: "boolean",
		examples: ['contains(title, "draft")', 'contains(file.name, "project")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const haystack = toString(args[0] ?? null);
		const needle = toString(args[1] ?? null);
		return haystack.includes(needle);
	}
}
