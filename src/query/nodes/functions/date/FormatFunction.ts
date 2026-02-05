/**
 * format(date, pattern) - Format date as string
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("FormatNode", {function: "format"})
export class FormatFunction extends FunctionExprNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "format",
		description: "Format date as string. Supports: YYYY, MM, DD, HH, mm, ss.",
		syntax: "format(date, pattern)",
		returnType: "string",
		examples: ['format(due, "YYYY-MM-DD")', 'format(time, "HH:mm")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const value = args[0] ?? null;
		const pattern = toString(args[1] ?? null);

		if (!(value instanceof Date)) {
			return null;
		}

		const pad = (n: number): string => n.toString().padStart(2, "0");

		return pattern
			.replace("YYYY", value.getFullYear().toString())
			.replace("MM", pad(value.getMonth() + 1))
			.replace("DD", pad(value.getDate()))
			.replace("HH", pad(value.getHours()))
			.replace("mm", pad(value.getMinutes()))
			.replace("ss", pad(value.getSeconds()));
	}
}
