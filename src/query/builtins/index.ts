/**
 * Built-in Function Registry
 */

import type {Value} from "../ast";
import {RuntimeError} from "../errors";
import {stringFunctions} from "./string";
import {fileFunctions} from "./file";
import {arrayFunctions} from "./array";
import {existenceFunctions} from "./existence";
import {dateFunctions} from "./date";

/**
 * Context passed to built-in functions during evaluation
 */
export interface FunctionContext {
	/** Current file path being evaluated */
	filePath: string;
	/** Get file properties */
	getProperties: (path: string) => Record<string, Value>;
	/** Get file metadata */
	getFileMetadata: (path: string) => FileMetadata | undefined;
}

export interface FileMetadata {
	name: string;
	path: string;
	folder: string;
	created: Date;
	modified: Date;
	size: number;
	tags: string[];
}

/**
 * Built-in function definition
 */
export interface BuiltinFunction {
	/** Minimum number of arguments */
	minArity: number;
	/** Maximum number of arguments (Infinity for variadic) */
	maxArity: number;
	/** Function implementation */
	call: (args: Value[], ctx: FunctionContext) => Value;
}

/**
 * Registry of all built-in functions
 */
export const BUILTIN_FUNCTIONS: Record<string, BuiltinFunction> = {
	// String functions
	...stringFunctions,
	// File functions
	...fileFunctions,
	// Array functions
	...arrayFunctions,
	// Existence functions
	...existenceFunctions,
	// Date functions
	...dateFunctions,
};

/**
 * Get a built-in function by name
 */
export function getBuiltin(name: string): BuiltinFunction | undefined {
	return BUILTIN_FUNCTIONS[name];
}

/**
 * Check if a function name is a known built-in
 */
export function isBuiltin(name: string): boolean {
	return name in BUILTIN_FUNCTIONS;
}

/**
 * Get all built-in function names
 */
export function getBuiltinNames(): string[] {
	return Object.keys(BUILTIN_FUNCTIONS);
}

/**
 * Call a built-in function
 */
export function callBuiltin(name: string, args: Value[], ctx: FunctionContext): Value {
	const fn = BUILTIN_FUNCTIONS[name];
	if (!fn) {
		throw new RuntimeError(`Unknown function: ${name}`);
	}
	if (args.length < fn.minArity) {
		throw new RuntimeError(`${name}() requires at least ${fn.minArity} argument(s), got ${args.length}`);
	}
	if (args.length > fn.maxArity) {
		throw new RuntimeError(`${name}() accepts at most ${fn.maxArity} argument(s), got ${args.length}`);
	}
	return fn.call(args, ctx);
}
