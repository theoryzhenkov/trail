/**
 * DateExprNode - Date expression with optional offset
 */

import {ExprNode} from "../base/ExprNode";
import {register} from "../registry";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {ExecutorContext} from "../context";

/**
 * Base types for date expressions
 */
export interface RelativeDateBase {
	type: "relativeDate";
	kind: "today" | "yesterday" | "tomorrow" | "startOfWeek" | "endOfWeek";
	span: Span;
}

export interface DateLiteralBase {
	type: "dateLiteral";
	value: Date;
	span: Span;
}

export interface PropertyBase {
	type: "property";
	node: ExprNode;
}

export type DateBase = RelativeDateBase | DateLiteralBase | PropertyBase;

export interface DateOffset {
	op: "+" | "-";
	value: number;
	unit: "d" | "w" | "m" | "y";
}

@register("dateExpr", {expr: true})
export class DateExprNode extends ExprNode {
	readonly base: DateBase;
	readonly offset?: DateOffset;

	static documentation: NodeDoc = {
		title: "Date Expression",
		description: "A date value with optional arithmetic offset.",
		syntax: "date [+|- duration]",
		examples: ["today", "today - 7d", "tomorrow + 1w", "file.created - 30d"],
	};

	static highlighting = "atom" as const;

	constructor(base: DateBase, span: Span, offset?: DateOffset) {
		super(span);
		this.base = base;
		this.offset = offset;
	}

	evaluate(ctx: ExecutorContext): Value {
		let baseDate: Value;

		if (this.base.type === "relativeDate") {
			baseDate = ctx.resolveRelativeDate(this.base.kind);
		} else if (this.base.type === "dateLiteral") {
			baseDate = this.base.value;
		} else if (this.base.type === "property") {
			baseDate = this.base.node.evaluate(ctx);
		} else {
			return null;
		}

		// If no offset or base isn't a date, return as-is
		if (!this.offset || !(baseDate instanceof Date)) {
			return baseDate;
		}

		// Apply offset
		const durationMs = ctx.durationToMs(this.offset.value, this.offset.unit);
		const ms = this.offset.op === "+" ? baseDate.getTime() + durationMs : baseDate.getTime() - durationMs;
		return new Date(ms);
	}

	validate(ctx: ValidationContext): void {
		if (this.base.type === "property") {
			this.base.node.validate(ctx);
		}
	}
}
