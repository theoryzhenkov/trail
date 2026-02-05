/**
 * CompareExprNode - Comparison expressions (=, !=, <, >, <=, >=, =?, !=?)
 */

import {BinaryNode} from "../base/BinaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, CompletionContext} from "../types";
import type {EvalContext} from "../context";
import {register} from "../registry";
import {compare, equals} from "../value-ops";

export type CompareOp = "=" | "!=" | "<" | ">" | "<=" | ">=" | "=?" | "!=?";

@register("CompareExprNode", {expr: true})
export class CompareExprNode extends BinaryNode {
	readonly op: CompareOp;

	static providesContexts: CompletionContext[] = ["after-expression"];

	static documentation: NodeDoc = {
		title: "Comparison Operator",
		description: "Compares two values. Supports equality, inequality, and ordering. Use =? and !=? for null-safe comparisons.",
		syntax: "expr op expr",
		examples: ['status = "active"', "priority > 3", 'status !=? "archived"'],
	};

	static highlighting = "operator" as const;

	constructor(op: CompareOp, left: ExprNode, right: ExprNode, span: Span) {
		super(left, right, span);
		this.op = op;
	}

	evaluate(ctx: EvalContext): Value {
		const left = this.left.evaluate(ctx);
		const right = this.right.evaluate(ctx);

		// Null-safe operators
		if (this.op === "=?") {
			if (left === null) return false;
			return equals(left, right);
		}
		if (this.op === "!=?") {
			if (left === null) return true;
			return !equals(left, right);
		}

		// Equality with null
		if (this.op === "=" || this.op === "!=") {
			if (right === null) {
				return this.op === "=" ? left === null : left !== null;
			}
			if (left === null) {
				return this.op === "=" ? right === null : right !== null;
			}
			return this.op === "=" ? equals(left, right) : !equals(left, right);
		}

		// Standard comparison - null propagates
		if (left === null || right === null) {
			return null;
		}

		switch (this.op) {
			case "<":
				return compare(left, right) < 0;
			case ">":
				return compare(left, right) > 0;
			case "<=":
				return compare(left, right) <= 0;
			case ">=":
				return compare(left, right) >= 0;
		}
		// Exhaustive check - should never reach here
		return null;
	}
}
