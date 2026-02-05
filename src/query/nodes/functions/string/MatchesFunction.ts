/**
 * matches(str, pattern, flags?) - Regex match
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("MatchesNode", {function: "matches"})
export class MatchesFunction extends FunctionExprNode {
	static minArity = 2;
	static maxArity = 3;
	static documentation: NodeDoc = {
		title: "matches",
		description: "Test string against regex pattern. Optional flags parameter.",
		syntax: "matches(string, pattern[, flags])",
		returnType: "boolean",
		examples: ['matches(title, "^\\\\d{4}")', 'matches(name, "test", "i")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const str = toString(args[0] ?? null);
		const pattern = toString(args[1] ?? null);
		const flags = args[2] !== undefined ? toString(args[2]) : "";
		try {
			const regex = new RegExp(pattern, flags);
			return regex.test(str);
		} catch {
			return false;
		}
	}
}
