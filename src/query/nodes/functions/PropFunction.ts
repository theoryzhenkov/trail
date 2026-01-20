/**
 * prop(name) - Access property by name (for reserved names)
 */

import {FunctionExprNode, toString} from "../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../types";
import type {ExecutorContext} from "../context";
import type {ExprNode} from "../base/ExprNode";
import {register} from "../registry";

@register("PropNode", {function: "prop"})
export class PropFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "prop",
		description: "Access property by name. Useful for reserved names or dynamic property access.",
		syntax: "prop(name)",
		returnType: "any",
		examples: ['prop("type")', 'prop("file.name")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const name = toString(args[0] ?? null);

		// Support dot notation for nested access
		const parts = name.split(".");

		// Check for special prefixes
		if (parts[0] === "file" && parts[1]) {
			return ctx.getFileProperty(parts[1]);
		}
		if (parts[0] === "traversal" && parts[1]) {
			return ctx.getTraversalProperty(parts[1]);
		}

		return ctx.getPropertyValue(name);
	}
}
