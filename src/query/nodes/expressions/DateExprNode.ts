/**
 * DateExprNode - Date expression with optional offset
 */

import type {SyntaxNode} from "@lezer/common";
import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {EvalContext} from "../context";
import {register, type ConvertContext} from "../registry";
import {DurationNode} from "../literals/DurationNode";

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

export type RelativeDateKind = "today" | "yesterday" | "tomorrow" | "startOfWeek" | "endOfWeek";

const RELATIVE_DATE_KEYWORDS = new Set(["today", "yesterday", "tomorrow", "startOfWeek", "endOfWeek"]);

@register("DateExprNode", {expr: true, term: "DateExpr"})
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

	evaluate(ctx: EvalContext): Value {
		let baseDate: Value;

		if (this.base.type === "relativeDate") {
			baseDate = ctx.env.resolveRelativeDate(this.base.kind);
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
		const durationMs = ctx.env.durationToMs(this.offset.value, this.offset.unit);
		const ms = this.offset.op === "+" ? baseDate.getTime() + durationMs : baseDate.getTime() - durationMs;
		return new Date(ms);
	}

	validate(ctx: ValidationContext): void {
		if (this.base.type === "property") {
			this.base.node.validate(ctx);
		}
	}

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): DateExprNode {
		const baseNode = node.getChild("DateBase");
		const offsetNode = node.getChild("DateOffset");
		if (!baseNode) throw new Error("Missing date base");

		const base = DateExprNode.convertDateBase(baseNode, ctx);
		const offset = offsetNode ? DateExprNode.convertDateOffset(offsetNode, ctx) : undefined;
		return new DateExprNode(base, ctx.span(node), offset);
	}

	private static convertDateBase(node: SyntaxNode, ctx: ConvertContext): DateBase {
		const dateLiteral = node.getChild("DateLiteral");
		const relativeDate = node.getChild("RelativeDate");

		if (dateLiteral) {
			const dateStr = ctx.text(dateLiteral);
			const date = new Date(dateStr);
			return {type: "dateLiteral", value: date, span: ctx.span(dateLiteral)};
		}

		if (relativeDate) {
			const kind = DateExprNode.convertRelativeDateKind(relativeDate, ctx);
			return {type: "relativeDate", kind, span: ctx.span(relativeDate)};
		}

		throw new Error("Invalid date base");
	}

	private static convertRelativeDateKind(node: SyntaxNode, ctx: ConvertContext): RelativeDateKind {
		const kids = ctx.allChildren(node);
		// Check children first, then node itself
		for (const kid of kids) {
			if (RELATIVE_DATE_KEYWORDS.has(kid.name)) {
				return kid.name as RelativeDateKind;
			}
		}
		// Check node itself for keyword nodes with no children
		if (RELATIVE_DATE_KEYWORDS.has(node.name)) {
			return node.name as RelativeDateKind;
		}
		return "today";
	}

	private static convertDateOffset(node: SyntaxNode, ctx: ConvertContext): DateOffset {
		const kids = ctx.allChildren(node);
		let op: "+" | "-" = "+";
		let duration: DurationNode | null = null;

		for (const kid of kids) {
			if (kid.name === "+") {
				op = "+";
			} else if (kid.name === "-") {
				op = "-";
			} else if (kid.name === "Duration") {
				duration = DurationNode.fromSyntax(kid, ctx);
			}
		}

		if (!duration) throw new Error("Missing duration in date offset");
		return {op, value: duration.value, unit: duration.unit};
	}
}
