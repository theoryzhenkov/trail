/**
 * OrExprNode - OR expressions
 */

import type {SyntaxNode} from "@lezer/common";
import {BinaryNode} from "../base/BinaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, Completable, CompletionContext} from "../types";
import type {EvalContext} from "../context";
import {register, type ConvertContext} from "../registry";
import {isTruthy} from "../value-ops";

@register("OrExprNode", {expr: true, term: "OrExpr"})
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

	evaluate(ctx: EvalContext): Value {
		// Short-circuit: if left is true, don't evaluate right
		if (isTruthy(this.left.evaluate(ctx))) return true;
		return isTruthy(this.right.evaluate(ctx));
	}

	/**
	 * Convert OrExpr - Lezer produces flat list, fold into left-associative binary nodes
	 */
	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): ExprNode {
		const kids = ctx.allChildren(node);
		const operands: ExprNode[] = [];
		for (const kid of kids) {
			if (ctx.isExpr(kid)) {
				operands.push(ctx.expr(kid));
			}
		}
		if (operands.length === 1) return operands[0]!;
		let result = operands[0]!;
		for (let i = 1; i < operands.length; i++) {
			const right = operands[i]!;
			result = new OrExprNode(result, right, {
				start: result.span.start,
				end: right.span.end,
			});
		}
		return result;
	}
}
