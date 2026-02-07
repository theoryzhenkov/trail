/**
 * NotExprNode - NOT/! expression
 */

import type {SyntaxNode} from "@lezer/common";
import {UnaryNode} from "../base/UnaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, CompletionContext, Completable} from "../types";
import type {EvalContext} from "../context";
import {register, type ConvertContext} from "../registry";
import {isTruthy} from "../value-ops";

@register("NotExprNode", {expr: true, term: "NotExpr"})
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

	/**
	 * Convert NotExpr - handles both "not" and "!" prefix
	 */
	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): ExprNode {
		const kids = ctx.allChildren(node);
		let hasNot = false;
		let operandNode: SyntaxNode | null = null;
		for (const kid of kids) {
			if (kid.name === "not" || kid.name === "!") {
				hasNot = true;
			} else {
				operandNode = kid;
			}
		}
		if (!operandNode) throw new Error("Missing operand in not expression");
		const operand = ctx.expr(operandNode);
		if (hasNot) {
			return new NotExprNode(operand, ctx.span(node));
		}
		return operand;
	}
}
