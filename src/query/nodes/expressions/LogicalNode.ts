/**
 * LogicalNode - AND/OR expressions
 */

import {BinaryNode} from "../base/BinaryNode";
import {ExprNode} from "../base/ExprNode";
import {register} from "../registry";
import type {Span, Value, NodeDoc} from "../types";
import type {ExecutorContext} from "../context";

@register("logical", {expr: true})
export class LogicalNode extends BinaryNode {
	readonly op: "and" | "or";

	static documentation: NodeDoc = {
		title: "Logical Operator",
		description: "Combines conditions with AND or OR. AND requires both to be true, OR requires at least one.",
		syntax: "expr AND expr | expr OR expr",
		examples: ['status = "active" and priority > 3', 'type = "note" or type = "project"'],
	};

	static highlighting = "operatorKeyword" as const;

	constructor(op: "and" | "or", left: ExprNode, right: ExprNode, span: Span) {
		super(left, right, span);
		this.op = op;
	}

	evaluate(ctx: ExecutorContext): Value {
		if (this.op === "and") {
			// Short-circuit: if left is false, don't evaluate right
			if (!ctx.isTruthy(this.left.evaluate(ctx))) return false;
			return ctx.isTruthy(this.right.evaluate(ctx));
		} else {
			// Short-circuit: if left is true, don't evaluate right
			if (ctx.isTruthy(this.left.evaluate(ctx))) return true;
			return ctx.isTruthy(this.right.evaluate(ctx));
		}
	}
}
