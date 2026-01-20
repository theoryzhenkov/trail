/**
 * WhereNode - WHERE clause
 *
 * Filters nodes based on a boolean expression.
 */

import {ClauseNode} from "../base/ClauseNode";
import type {ExprNode} from "../base/ExprNode";
import type {Span, NodeDoc, ValidationContext} from "../types";
import type {ExecutorContext} from "../context";
import {register} from "../registry";

@register("WhereNode", {clause: true})
export class WhereNode extends ClauseNode {
	readonly expression: ExprNode;

	static documentation: NodeDoc = {
		title: "WHERE clause",
		description: "Filters results to only include nodes where the expression is true.",
		syntax: "where expression",
		examples: [
			"where status = \"done\"",
			"where priority > 3",
			"where tags in \"important\"",
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
	 * Test whether the current node passes the filter.
	 * Returns true if the expression evaluates to a truthy value.
	 */
	test(ctx: ExecutorContext): boolean {
		const result = this.expression.evaluate(ctx);
		return ctx.isTruthy(result);
	}
}
