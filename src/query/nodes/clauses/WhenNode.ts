/**
 * WhenNode - WHEN clause
 *
 * Conditionally shows the query based on the active file.
 *
 * @see docs/syntax/query.md#when
 */

import type {SyntaxNode} from "@lezer/common";
import {Node} from "../base/Node";
import type {ExprNode} from "../base/ExprNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import type {EvalContext} from "../context";
import {register, type ConvertContext} from "../registry";
import {isTruthy} from "../value-ops";
import {findExpressionInClause} from "./WhereNode";

@register("WhenNode", {clause: true})
export class WhenNode extends Node {
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
	test(ctx: EvalContext): boolean {
		const result = this.expression.evaluate(ctx);
		return isTruthy(result);
	}

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): WhenNode {
		const expr = findExpressionInClause(node, ctx);
		return new WhenNode(expr, ctx.span(node));
	}
}
