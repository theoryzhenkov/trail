/**
 * PruneNode - PRUNE clause
 *
 * Stops traversal when a condition is met.
 */

import {ClauseNode} from "../base/ClauseNode";
import type {ExprNode} from "../base/ExprNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext} from "../types";
import type {ExecutorContext} from "../context";
import {register} from "../registry";

@register("PruneNode", {clause: true})
export class PruneNode extends ClauseNode {
	readonly expression: ExprNode;

	static providesContexts: CompletionContext[] = ["expression", "clause"];

	static documentation: NodeDoc = {
		title: "PRUNE clause",
		description: "Stops traversal at nodes where the expression is true. The pruned node is still included, but its children are not traversed.",
		syntax: "prune expression",
		examples: [
			"prune status = \"archived\"",
			"prune $depth > 3",
			"prune type = \"folder\"",
		],
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
