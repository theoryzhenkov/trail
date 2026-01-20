/**
 * FunctionNode - Base class for function implementations
 * 
 * Functions don't extend ExprNode because they're not AST nodes themselves -
 * they are implementations called by CallNode.
 */

import type {Value, NodeDoc} from "../types";
import type {ExecutorContext} from "../context";
import {registerFunction} from "../expressions/CallNode";

/**
 * Abstract base for function implementations
 */
export abstract class FunctionNode {
	/**
	 * Minimum number of arguments
	 */
	static minArity: number;

	/**
	 * Maximum number of arguments (Infinity for variadic)
	 */
	static maxArity: number;

	/**
	 * Function documentation
	 */
	static documentation: NodeDoc | undefined;

	/**
	 * Evaluate the function with the given arguments
	 */
	static evaluate(_args: Value[], _ctx: ExecutorContext): Value {
		throw new Error("Function.evaluate must be implemented");
	}
}

/**
 * Helper to convert value to string
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
 * Register a function class
 */
export function registerFunc(name: string, cls: typeof FunctionNode): void {
	registerFunction(name, {
		minArity: cls.minArity,
		maxArity: cls.maxArity,
		evaluate: cls.evaluate.bind(cls),
		documentation: cls.documentation,
	});
}
