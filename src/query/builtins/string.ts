/**
 * String Built-in Functions
 */

import type {Value} from "../ast";
import type {BuiltinFunction, FunctionContext} from "./index";

function toString(value: Value): string {
	if (value === null) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	if (typeof value === "boolean") return String(value);
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(toString).join(",");
	return String(value);
}

export const stringFunctions: Record<string, BuiltinFunction> = {
	/**
	 * contains(haystack, needle) - Check if string contains substring
	 */
	contains: {
		minArity: 2,
		maxArity: 2,
		call: (args: Value[]): Value => {
			const haystack = toString(args[0] ?? null);
			const needle = toString(args[1] ?? null);
			return haystack.includes(needle);
		},
	},

	/**
	 * startsWith(str, prefix) - Check if string starts with prefix
	 */
	startsWith: {
		minArity: 2,
		maxArity: 2,
		call: (args: Value[]): Value => {
			const str = toString(args[0] ?? null);
			const prefix = toString(args[1] ?? null);
			return str.startsWith(prefix);
		},
	},

	/**
	 * endsWith(str, suffix) - Check if string ends with suffix
	 */
	endsWith: {
		minArity: 2,
		maxArity: 2,
		call: (args: Value[]): Value => {
			const str = toString(args[0] ?? null);
			const suffix = toString(args[1] ?? null);
			return str.endsWith(suffix);
		},
	},

	/**
	 * length(str) - Get string length
	 */
	length: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const value = args[0] ?? null;
			if (value === null) return 0;
			if (typeof value === "string") return value.length;
			if (Array.isArray(value)) return value.length;
			return toString(value).length;
		},
	},

	/**
	 * lower(str) - Convert to lowercase
	 */
	lower: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			return toString(args[0] ?? null).toLowerCase();
		},
	},

	/**
	 * upper(str) - Convert to uppercase
	 */
	upper: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			return toString(args[0] ?? null).toUpperCase();
		},
	},

	/**
	 * trim(str) - Remove leading/trailing whitespace
	 */
	trim: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			return toString(args[0] ?? null).trim();
		},
	},

	/**
	 * split(str, delimiter) - Split string into array
	 */
	split: {
		minArity: 2,
		maxArity: 2,
		call: (args: Value[]): Value => {
			const str = toString(args[0] ?? null);
			const delimiter = toString(args[1] ?? null);
			return str.split(delimiter);
		},
	},

	/**
	 * matches(str, pattern, flags?) - Regex match
	 */
	matches: {
		minArity: 2,
		maxArity: 3,
		call: (args: Value[]): Value => {
			const str = toString(args[0] ?? null);
			const pattern = toString(args[1] ?? null);
			const flags = args[2] !== undefined ? toString(args[2]) : "";
			try {
				const regex = new RegExp(pattern, flags);
				return regex.test(str);
			} catch {
				return false;
			}
		},
	},
};
