/**
 * AndExprNode - AND expressions
 */

import type {SyntaxNode} from "@lezer/common";
import {BinaryNode} from "../base/BinaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, Completable, CompletionContext} from "../types";
import type {EvalContext} from "../context";
import {register, type ConvertContext} from "../registry";
import {isTruthy} from "../value-ops";

@register("AndExprNode", {expr: true, term: "AndExpr"})
export class AndExprNode extends BinaryNode {
	static providesContexts: CompletionContext[] = ["after-expression"];

	static documentation: NodeDoc = {
		title: "Logical AND Operator",
		description: "Combines conditions with AND. Requires both to be true.",
		syntax: "expr AND expr",
		examples: ['status = "active" and priority > 3'],
	};

	static highlighting = "operatorKeyword" as const;

	static completable: Completable = {
		keywords: ["and"],
		context: "after-expression",
		priority: 90,
		category: "operator",
	};

	constructor(left: ExprNode, right: ExprNode, span: Span) {
		super(left, right, span);
	}

	evaluate(ctx: EvalContext): Value {
		// Short-circuit: if left is false, don't evaluate right
		if (!isTruthy(this.left.evaluate(ctx))) return false;
		return isTruthy(this.right.evaluate(ctx));
	}

	/**
	 * Convert AndExpr - same folding pattern as OrExpr
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
			result = new AndExprNode(result, right, {
				start: result.span.start,
				end: right.span.end,
			});
		}
		return result;
	}
}
