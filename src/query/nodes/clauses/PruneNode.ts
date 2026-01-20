/**
 * PruneNode - PRUNE clause
 *
 * Stops traversal when a condition is met.
 */

import {ClauseNode} from "../base/ClauseNode";
import type {ExprNode} from "../base/ExprNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import type {ExecutorContext} from "../context";
import {register} from "../registry";

@register("PruneNode", {clause: true})
export class PruneNode extends ClauseNode {
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
	test(ctx: ExecutorContext): boolean {
		const result = this.expression.evaluate(ctx);
		return ctx.isTruthy(result);
	}
}
