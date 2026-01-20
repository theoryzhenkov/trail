/**
 * OrExprNode - OR expressions
 */

import {BinaryNode} from "../base/BinaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, Completable, CompletionContext} from "../types";
import type {ExecutorContext} from "../context";
import {register} from "../registry";

@register("OrExprNode", {expr: true})
export class OrExprNode extends BinaryNode {
	static providesContexts: CompletionContext[] = ["after-expression"];

	static documentation: NodeDoc = {
		title: "Logical OR Operator",
		description: "Combines conditions with OR. Requires at least one to be true.",
		syntax: "expr OR expr",
		examples: ['type = "note" or type = "project"'],
	};

	static highlighting = "operatorKeyword" as const;

	static completable: Completable = {
		keywords: ["or"],
		context: "after-expression",
		priority: 90,
		category: "operator",
	};

	constructor(left: ExprNode, right: ExprNode, span: Span) {
		super(left, right, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		// Short-circuit: if left is true, don't evaluate right
		if (ctx.isTruthy(this.left.evaluate(ctx))) return true;
		return ctx.isTruthy(this.right.evaluate(ctx));
	}
}
