/**
 * NotExprNode - NOT/! expression
 */

import {UnaryNode} from "../base/UnaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, CompletionContext, Completable} from "../types";
import type {EvalContext} from "../context";
import {register} from "../registry";
import {isTruthy} from "../value-ops";

@register("NotExprNode", {expr: true})
export class NotExprNode extends UnaryNode {
	static providesContexts: CompletionContext[] = ["expression"];

	static documentation: NodeDoc = {
		title: "NOT operator",
		description: "Logical NOT. Inverts the condition. Can also use '!' prefix.",
		syntax: "not Expr | !Expr",
		examples: ['not status = "archived"', '!hasTag("private")'],
	};

	static highlighting = "operatorKeyword" as const;

	static completable: Completable = {
		keywords: ["not"],
		context: "expression",
		priority: 80,
		category: "operator",
	};

	constructor(operand: ExprNode, span: Span) {
		super(operand, span);
	}

	evaluate(ctx: EvalContext): Value {
		const operand = this.operand.evaluate(ctx);
		return !isTruthy(operand);
	}
}
