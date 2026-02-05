/**
 * WhereNode - WHERE clause
 *
 * Filters nodes based on a boolean expression.
 *
 * @see docs/syntax/query.md#where
 */

import {ClauseNode} from "../base/ClauseNode";
import type {ExprNode} from "../base/ExprNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import type {EvalContext} from "../context";
import {register} from "../registry";
import {isTruthy} from "../value-ops";

@register("WhereNode", {clause: true})
export class WhereNode extends ClauseNode {
	readonly expression: ExprNode;

	static providesContexts: CompletionContext[] = ["expression", "clause"];

	static documentation: NodeDoc = {
		title: "WHERE clause",
		description:
			"Filters results after traversal. Non-matching nodes are hidden but their children may still appear with a gap indicator.",
		syntax: "where Expression",
		examples: [
			"where priority >= 3",
			'where status != "archived"',
			'where hasTag("active") and exists(due)',
		],
	};

	static completable: Completable = {
		keywords: ["where"],
		context: "clause",
		priority: 80,
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
	 * Test whether the current node passes the filter.
	 * Returns true if the expression evaluates to a truthy value.
	 */
	test(ctx: EvalContext): boolean {
		const result = this.expression.evaluate(ctx);
		return isTruthy(result);
	}
}
