/**
 * WhenNode - WHEN clause
 *
 * Conditionally shows the query based on the active file.
 */

import {ClauseNode} from "../base/ClauseNode";
import type {ExprNode} from "../base/ExprNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import type {ExecutorContext} from "../context";
import {register} from "../registry";

@register("WhenNode", {clause: true})
export class WhenNode extends ClauseNode {
	readonly expression: ExprNode;

	static providesContexts: CompletionContext[] = ["expression", "clause"];

	static documentation: NodeDoc = {
		title: "WHEN clause",
		description:
			"Conditional visibility for the entire group. If the active file doesn't match, the group is hidden.",
		syntax: "when Expression",
		examples: ['when type = "project"', 'when hasTag("daily")', 'when file.folder = "Projects"'],
	};

	static completable: Completable = {
		keywords: ["when"],
		context: "clause",
		priority: 70,
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
	 * Test whether the query should be shown.
	 * Returns true if the expression evaluates to a truthy value.
	 */
	test(ctx: ExecutorContext): boolean {
		const result = this.expression.evaluate(ctx);
		return ctx.isTruthy(result);
	}
}
