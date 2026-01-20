/**
 * CompareNode - Comparison expressions (=, !=, <, >, <=, >=, =?, !=?)
 */

import {BinaryNode} from "../base/BinaryNode";
import {ExprNode} from "../base/ExprNode";
import {register} from "../registry";
import type {Span, Value, NodeDoc} from "../types";
import type {ExecutorContext} from "../context";

export type CompareOp = "=" | "!=" | "<" | ">" | "<=" | ">=" | "=?" | "!=?";

@register("compare", {expr: true})
export class CompareNode extends BinaryNode {
	readonly op: CompareOp;

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

	evaluate(ctx: ExecutorContext): Value {
		const left = this.left.evaluate(ctx);
		const right = this.right.evaluate(ctx);

		// Null-safe operators
		if (this.op === "=?") {
			if (left === null) return false;
			return ctx.equals(left, right);
		}
		if (this.op === "!=?") {
			if (left === null) return true;
			return !ctx.equals(left, right);
		}

		// Equality with null
		if (this.op === "=" || this.op === "!=") {
			if (right === null) {
				return this.op === "=" ? left === null : left !== null;
			}
			if (left === null) {
				return this.op === "=" ? right === null : right !== null;
			}
			return this.op === "=" ? ctx.equals(left, right) : !ctx.equals(left, right);
		}

		// Standard comparison - null propagates
		if (left === null || right === null) {
			return null;
		}

		switch (this.op) {
			case "<":
				return ctx.compare(left, right) < 0;
			case ">":
				return ctx.compare(left, right) > 0;
			case "<=":
				return ctx.compare(left, right) <= 0;
			case ">=":
				return ctx.compare(left, right) >= 0;
		}
		// Exhaustive check - should never reach here
		return null;
	}
}
