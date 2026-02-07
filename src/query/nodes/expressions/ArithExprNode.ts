/**
 * ArithExprNode - Arithmetic expressions (+, -)
 */

import type {SyntaxNode} from "@lezer/common";
import {BinaryNode} from "../base/BinaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, CompletionContext} from "../types";
import type {EvalContext} from "../context";
import {register, type ConvertContext} from "../registry";

@register("ArithExprNode", {expr: true, term: "ArithExpr"})
export class ArithExprNode extends BinaryNode {
	readonly op: "+" | "-";

	static providesContexts: CompletionContext[] = ["after-expression"];

	static documentation: NodeDoc = {
		title: "Arithmetic Operator",
		description: "Addition or subtraction. Works with numbers, dates + durations, and string concatenation.",
		syntax: "expr + expr | expr - expr",
		examples: ["priority + 1", "today - 7d", 'name + " suffix"'],
	};

	static highlighting = "operator" as const;

	constructor(op: "+" | "-", left: ExprNode, right: ExprNode, span: Span) {
		super(left, right, span);
		this.op = op;
	}

	evaluate(ctx: EvalContext): Value {
		const left = this.left.evaluate(ctx);
		const right = this.right.evaluate(ctx);

		if (left === null || right === null) {
			return null;
		}

		// Date arithmetic
		if (left instanceof Date && typeof right === "number") {
			const ms = this.op === "+" ? left.getTime() + right : left.getTime() - right;
			return new Date(ms);
		}

		// Number arithmetic
		if (typeof left === "number" && typeof right === "number") {
			return this.op === "+" ? left + right : left - right;
		}

		// String concatenation
		if (typeof left === "string" && this.op === "+") {
			return left + String(right);
		}

		ctx.env.addError(`Cannot perform ${this.op} on ${typeof left} and ${typeof right}`, this.span);
		return null;
	}

	/**
	 * Convert ArithExpr - handles + and - operators, builds left-associative tree
	 */
	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): ExprNode {
		const kids = ctx.allChildren(node);
		const parts: Array<{type: "operand"; node: ExprNode} | {type: "op"; op: "+" | "-"}> = [];
		for (const kid of kids) {
			if (kid.name === "+") {
				parts.push({type: "op", op: "+"});
			} else if (kid.name === "-") {
				parts.push({type: "op", op: "-"});
			} else if (ctx.isExpr(kid)) {
				parts.push({type: "operand", node: ctx.expr(kid)});
			}
		}
		if (parts.length === 1 && parts[0]?.type === "operand") {
			return parts[0].node;
		}
		let result: ExprNode | null = null;
		let pendingOp: "+" | "-" | null = null;
		for (const part of parts) {
			if (part.type === "operand") {
				if (result === null) {
					result = part.node;
				} else if (pendingOp) {
					result = new ArithExprNode(pendingOp, result, part.node, {
						start: result.span.start,
						end: part.node.span.end,
					});
					pendingOp = null;
				}
			} else {
				pendingOp = part.op;
			}
		}
		if (!result) throw new Error("Empty ArithExpr");
		return result;
	}
}
