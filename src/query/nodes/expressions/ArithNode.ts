/**
 * ArithNode - Arithmetic expressions (+, -)
 */

import {BinaryNode} from "../base/BinaryNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc} from "../types";
import type {ExecutorContext} from "../context";

export class ArithNode extends BinaryNode {
	readonly op: "+" | "-";

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

	evaluate(ctx: ExecutorContext): Value {
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

		ctx.addError(`Cannot perform ${this.op} on ${typeof left} and ${typeof right}`, this.span);
		return null;
	}
}
