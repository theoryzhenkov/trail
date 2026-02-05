/**
 * DurationNode - Duration literal
 */

import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {EvalContext} from "../context";
import {register} from "../registry";

export type DurationUnit = "d" | "w" | "m" | "y";

@register("DurationNode")
export class DurationNode extends ExprNode {
	readonly value: number;
	readonly unit: DurationUnit;

	static documentation: NodeDoc = {
		title: "Duration Literal",
		description: "A time duration. Units: d (days), w (weeks), m (months), y (years).",
		syntax: "Nd | Nw | Nm | Ny",
		examples: ["7d", "2w", "1m", "1y"],
	};

	static highlighting = "number" as const;

	constructor(value: number, unit: DurationUnit, span: Span) {
		super(span);
		this.value = value;
		this.unit = unit;
	}

	/**
	 * Durations evaluate to milliseconds for arithmetic
	 */
	evaluate(ctx: EvalContext): Value {
		return ctx.env.durationToMs(this.value, this.unit);
	}

	validate(_ctx: ValidationContext): void {
		// Duration literals are always valid
	}
}
