/**
 * FunctionExprNode - Base class for function expression nodes
 *
 * Provides common patterns for function nodes:
 * - args array for function arguments
 * - Static minArity/maxArity for arity validation
 * - toString() helper for string coercion
 * - validate() implementation that validates args
 */

import {ExprNode} from "./ExprNode";
import type {Span, Value, NodeDoc, ValidationContext, Completable} from "../types";
import type {EvalContext} from "../context";

/**
 * Abstract base class for function expression nodes
 */
export abstract class FunctionExprNode extends ExprNode {
	/**
	 * Minimum number of arguments required
	 */
	static minArity: number;

	/**
	 * Maximum number of arguments allowed (Infinity for variadic)
	 */
	static maxArity: number;

	/**
	 * Documentation for this function
	 */
	static documentation: NodeDoc | undefined;

	/**
	 * Completion metadata for autocomplete
	 */
	static completable: Completable | undefined;

	/**
	 * Highlighting category
	 */
	static highlighting = "function" as const;

	/**
	 * Function arguments as expression nodes
	 */
	readonly args: ExprNode[];

	constructor(args: ExprNode[], span: Span) {
		super(span);
		this.args = args;
	}

	/**
	 * Evaluate this function with the given context.
	 * Subclasses should implement this to perform the actual function logic.
	 */
	abstract evaluate(ctx: EvalContext): Value;

	/**
	 * Validate this function node.
	 * Checks arity and validates all arguments.
	 */
	validate(ctx: ValidationContext): void {
		// Validate all arguments
		for (const arg of this.args) {
			arg.validate(ctx);
		}
	}

	/**
	 * Evaluate all arguments and return their values
	 */
	protected evaluateArgs(ctx: EvalContext): Value[] {
		return this.args.map((arg) => arg.evaluate(ctx));
	}
}

/**
 * Helper to convert a value to string (TQL semantics)
 */
export function toString(value: Value): string {
	if (value === null) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	if (typeof value === "boolean") return String(value);
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(toString).join(",");
	return String(value);
}

/**
 * Helper to convert a value to number (TQL semantics)
 */
export function toNumber(value: Value): number {
	if (value === null) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const num = parseFloat(value);
		return isNaN(num) ? 0 : num;
	}
	if (typeof value === "boolean") return value ? 1 : 0;
	if (value instanceof Date) return value.getTime();
	return 0;
}

/**
 * Helper to convert a value to Date (TQL semantics)
 */
export function toDate(value: Value): Date | null {
	if (value === null) return null;
	if (value instanceof Date) return value;
	if (typeof value === "string") {
		const date = new Date(value);
		return isNaN(date.getTime()) ? null : date;
	}
	if (typeof value === "number") return new Date(value);
	return null;
}

/**
 * Helper to check if a value is an array
 */
export function toArray(value: Value): Value[] {
	if (Array.isArray(value)) return value;
	if (value === null) return [];
	return [value];
}
