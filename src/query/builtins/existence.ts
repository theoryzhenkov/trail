/**
 * Existence and Null-handling Built-in Functions
 */

import type {Value} from "../ast";
import type {BuiltinFunction} from "./index";

export const existenceFunctions: Record<string, BuiltinFunction> = {
	/**
	 * exists(property) - Check if property is defined and not null
	 */
	exists: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const value = args[0];
			return value !== null && value !== undefined;
		},
	},

	/**
	 * coalesce(a, b, ...) - Return first non-null value
	 */
	coalesce: {
		minArity: 1,
		maxArity: Infinity,
		call: (args: Value[]): Value => {
			for (const arg of args) {
				if (arg !== null && arg !== undefined) {
					return arg;
				}
			}
			return null;
		},
	},

	/**
	 * ifnull(value, default) - Return value if not null, else default
	 */
	ifnull: {
		minArity: 2,
		maxArity: 2,
		call: (args: Value[]): Value => {
			const value = args[0] ?? null;
			const defaultValue = args[1] ?? null;
			return value !== null ? value : defaultValue;
		},
	},
};
