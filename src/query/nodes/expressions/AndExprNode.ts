/**
 * AndExprNode - AND expressions
 */

import {BinaryNode} from "../base/BinaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, Completable, CompletionContext} from "../types";
import type {EvalContext} from "../context";
import {register} from "../registry";
import {isTruthy} from "../value-ops";

@register("AndExprNode", {expr: true})
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
}
