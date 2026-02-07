/**
 * CompareExprNode - Comparison expressions (=, !=, <, >, <=, >=, =?, !=?)
 */

import type {SyntaxNode} from "@lezer/common";
import {BinaryNode} from "../base/BinaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, CompletionContext} from "../types";
import type {EvalContext} from "../context";
import {register, type ConvertContext} from "../registry";
import {compare, equals} from "../value-ops";
import {InExprNode} from "./InExprNode";

export type CompareOp = "=" | "!=" | "<" | ">" | "<=" | ">=" | "=?" | "!=?";

const COMPARE_OPS = new Set(["=", "!=", "<", ">", "<=", ">=", "=?", "!=?"]);

@register("CompareExprNode", {expr: true, term: "CompareExpr"})
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

	/**
	 * Convert CompareExpr - handles comparison operators and delegates "in" expressions
	 */
	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): ExprNode {
		const kids = ctx.allChildren(node);
		const operands: ExprNode[] = [];
		let operator: string | null = null;
		let inExpr: SyntaxNode | null = null;

		for (const kid of kids) {
			if (kid.name === "InExpr") {
				inExpr = kid;
			} else if (COMPARE_OPS.has(kid.name)) {
				operator = kid.name;
			} else if (ctx.isExpr(kid)) {
				operands.push(ctx.expr(kid));
			}
		}

		// Handle "in" expression
		if (inExpr) {
			return InExprNode.fromInSyntax(operands[0]!, inExpr, ctx);
		}

		// Simple expression without comparison
		if (!operator) {
			if (operands.length === 1) return operands[0]!;
			throw new Error("CompareExpr without operator must have single operand");
		}

		if (operands.length !== 2) {
			throw new Error(`CompareExpr requires 2 operands, got ${operands.length}`);
		}

		return new CompareExprNode(
			operator as CompareOp,
			operands[0]!,
			operands[1]!,
			ctx.span(node)
		);
	}
}
