/**
 * PruneNode - PRUNE clause
 *
 * Stops traversal when a condition is met.
 *
 * @see docs/syntax/query.md#prune
 */

import type {SyntaxNode} from "@lezer/common";
import {Node} from "../base/Node";
import type {ExprNode} from "../base/ExprNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import type {EvalContext} from "../context";
import {register, type ConvertContext} from "../registry";
import {isTruthy} from "../value-ops";
import {findExpressionInClause} from "./WhereNode";

@register("PruneNode", {clause: true})
export class PruneNode extends Node {
	readonly expression: ExprNode;

	static providesContexts: CompletionContext[] = ["expression", "clause"];

	static documentation: NodeDoc = {
		title: "PRUNE clause",
		description:
			"Stops traversal at nodes matching the expression. Matching nodes and their subtrees are not visited.",
		syntax: "prune Expression",
		examples: ['prune status = "archived"', 'prune hasTag("private")', "prune traversal.depth > 5"],
	};

	static completable: Completable = {
		keywords: ["prune"],
		context: "clause",
		priority: 50,
		category: "keyword",
	};

	constructor(expression: ExprNode, span: Span) {
		super(span);
		this.expression = expression;
	}

	validate(ctx: ValidationContext): void {
		this.expression.validate(ctx);
	}

	/**
	 * Test whether traversal should be pruned at the current node.
	 * Returns true if the expression evaluates to a truthy value.
	 */
	test(ctx: EvalContext): boolean {
		const result = this.expression.evaluate(ctx);
		return isTruthy(result);
	}

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): PruneNode {
		const expr = findExpressionInClause(node, ctx);
		return new PruneNode(expr, ctx.span(node));
	}
}
