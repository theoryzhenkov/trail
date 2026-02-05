/**
 * Pure value operations for TQL runtime values.
 *
 * Single source of truth for compare, equals, and isTruthy semantics.
 * Used by expression evaluation, sorting, and filtering.
 */

import type {Value} from "./types";

/**
 * Compare two values for ordering.
 *
 * Null sorts last (after all non-null values).
 * Numbers, strings, and Dates use natural ordering.
 * Mismatched types fall back to string comparison.
 */
export function compare(a: Value, b: Value): number {
	if (a === b) return 0;
	if (a === null) return 1;
	if (b === null) return -1;

	if (typeof a === "number" && typeof b === "number") {
		return a - b;
	}
	if (typeof a === "string" && typeof b === "string") {
		return a.localeCompare(b);
	}
	if (a instanceof Date && b instanceof Date) {
		return a.getTime() - b.getTime();
	}

	return String(a).localeCompare(String(b));
}

/**
 * Deep equality check for two values.
 *
 * Handles Date comparison by timestamp and recursive array comparison.
 * Returns false if either value is null (unless both are identical via ===).
 */
export function equals(a: Value, b: Value): boolean {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((v, i) => equals(v, b[i] ?? null));
	}
	return a === b;
}

/**
 * Check if a value is truthy in TQL semantics.
 *
 * Falsy values: null, false, 0, "", empty array.
 * Everything else is truthy.
 */
export function isTruthy(value: Value): boolean {
	if (value === null) return false;
	if (value === false) return false;
	if (value === 0) return false;
	if (value === "") return false;
	if (Array.isArray(value) && value.length === 0) return false;
	return true;
}
