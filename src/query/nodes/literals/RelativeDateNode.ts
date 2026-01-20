/**
 * RelativeDateNode - Relative date literal (today, yesterday, etc.)
 */

import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {ExecutorContext} from "../context";
import {register} from "../registry";

export type RelativeDateKind = "today" | "yesterday" | "tomorrow" | "startOfWeek" | "endOfWeek";

@register("RelativeDateNode")
export class RelativeDateNode extends ExprNode {
	readonly kind: RelativeDateKind;

	static documentation: NodeDoc = {
		title: "Relative Date",
		description: "A date relative to the current day. Resolved at query execution time.",
		syntax: "today | yesterday | tomorrow | startOfWeek | endOfWeek",
		examples: ["today", "yesterday", "startOfWeek"],
	};

	static highlighting = "atom" as const;

	constructor(kind: RelativeDateKind, span: Span) {
		super(span);
		this.kind = kind;
	}

	evaluate(ctx: ExecutorContext): Value {
		return ctx.resolveRelativeDate(this.kind);
	}

	validate(_ctx: ValidationContext): void {
		// Relative dates are always valid
	}
}
