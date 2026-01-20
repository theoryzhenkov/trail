/**
 * CallNode - Function call expression
 *
 * This is a dispatcher that looks up function implementations
 * from the function registry.
 */

import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {ExecutorContext} from "../context";
import {register} from "../registry";

// Forward declaration - will be replaced with actual function registry
type FunctionImpl = {
	minArity: number;
	maxArity: number;
	evaluate: (args: Value[], ctx: ExecutorContext) => Value;
};

// Function registry - will be populated by function nodes
const functionRegistry = new Map<string, FunctionImpl>();

/**
 * Register a function implementation
 */
export function registerFunction(name: string, impl: FunctionImpl): void {
	functionRegistry.set(name.toLowerCase(), impl);
}

/**
 * Get a function implementation
 */
export function getFunction(name: string): FunctionImpl | undefined {
	return functionRegistry.get(name.toLowerCase());
}

/**
 * Check if a function exists
 */
export function hasFunction(name: string): boolean {
	return functionRegistry.has(name.toLowerCase());
}

@register("CallNode", {expr: true})
export class CallNode extends ExprNode {
	readonly name: string;
	readonly args: ExprNode[];

	static documentation: NodeDoc = {
		title: "Function Call",
		description: "Calls a built-in function with arguments.",
		syntax: "function(arg1, arg2, ...)",
		examples: ['hasTag("project")', "contains(title, \"draft\")", "length(tags)"],
	};

	static highlighting = "function" as const;

	constructor(name: string, args: ExprNode[], span: Span) {
		super(span);
		this.name = name;
		this.args = args;
	}

	evaluate(ctx: ExecutorContext): Value {
		const fn = getFunction(this.name);
		if (!fn) {
			ctx.addError(`Unknown function: ${this.name}`, this.span);
			return null;
		}

		// Evaluate arguments
		const evaluatedArgs = this.args.map((arg) => arg.evaluate(ctx));

		// Call the function
		return fn.evaluate(evaluatedArgs, ctx);
	}

	validate(ctx: ValidationContext): void {
		const fn = getFunction(this.name);
		if (!fn) {
			ctx.addError(`Unknown function: ${this.name}`, this.span, "UNKNOWN_FUNCTION");
		} else {
			if (this.args.length < fn.minArity) {
				ctx.addError(
					`${this.name}() requires at least ${fn.minArity} argument(s), got ${this.args.length}`,
					this.span,
					"INVALID_ARITY"
				);
			} else if (this.args.length > fn.maxArity) {
				ctx.addError(
					`${this.name}() accepts at most ${fn.maxArity} argument(s), got ${this.args.length}`,
					this.span,
					"INVALID_ARITY"
				);
			}
		}

		// Validate arguments
		for (const arg of this.args) {
			arg.validate(ctx);
		}
	}
}
