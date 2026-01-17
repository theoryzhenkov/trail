/**
 * Array Built-in Functions
 */

import type {Value} from "../ast";
import type {BuiltinFunction} from "./index";

export const arrayFunctions: Record<string, BuiltinFunction> = {
	/**
	 * len(array) - Get array length
	 */
	len: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const value = args[0] ?? null;
			if (value === null) return 0;
			if (Array.isArray(value)) return value.length;
			if (typeof value === "string") return value.length;
			return 0;
		},
	},

	/**
	 * first(array) - Get first element or null
	 */
	first: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const value = args[0] ?? null;
			if (Array.isArray(value) && value.length > 0) {
				return value[0] ?? null;
			}
			return null;
		},
	},

	/**
	 * last(array) - Get last element or null
	 */
	last: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const value = args[0] ?? null;
			if (Array.isArray(value) && value.length > 0) {
				return value[value.length - 1] ?? null;
			}
			return null;
		},
	},

	/**
	 * isEmpty(value) - Check if null, empty string, or empty array
	 */
	isEmpty: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const value = args[0] ?? null;
			if (value === null) return true;
			if (value === "") return true;
			if (Array.isArray(value) && value.length === 0) return true;
			return false;
		},
	},
};
