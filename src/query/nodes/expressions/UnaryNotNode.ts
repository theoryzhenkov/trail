/**
 * UnaryNotNode - NOT/! expression
 */

import {UnaryNode} from "../base/UnaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc} from "../types";
import type {ExecutorContext} from "../context";

export class UnaryNotNode extends UnaryNode {
	static documentation: NodeDoc = {
		title: "NOT Operator",
		description: "Logical NOT. Inverts the truthiness of the expression.",
		syntax: "not expr | !expr",
		examples: ['not status = "archived"', '!hasTag("private")'],
	};

	static highlighting = "operatorKeyword" as const;

	constructor(operand: ExprNode, span: Span) {
		super(operand, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const operand = this.operand.evaluate(ctx);
		return !ctx.isTruthy(operand);
	}
}
