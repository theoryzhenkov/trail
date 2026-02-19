import { FileProperties, PropertyFilter, RelationDefinition } from "../types";

export function evaluatePropertyFilter(
	properties: FileProperties,
	filter: PropertyFilter,
): boolean {
	const key = filter.key.trim().toLowerCase();
	if (!key) {
		return true;
	}
	const value = properties[key];

	switch (filter.operator) {
		case "exists":
			return value !== undefined;
		case "notExists":
			return value === undefined;
		case "equals":
			return matchesEquals(value, filter.value);
		case "contains":
			return matchesContains(value, filter.value);
		default:
			return true;
	}
}

export function buildPropertyExcludeKeys(
	relations: RelationDefinition[],
): Set<string> {
	const keys = new Set<string>();
	for (const relation of relations) {
		for (const alias of relation.aliases) {
			keys.add(alias.key.toLowerCase());
		}
	}
	return keys;
}

function matchesEquals(
	value: FileProperties[string] | undefined,
	expected: PropertyFilter["value"],
): boolean {
	if (value === undefined) {
		return false;
	}
	if (value === null) {
		return expected === null;
	}
	if (expected === undefined) {
		return false;
	}
	if (Array.isArray(value)) {
		const expectedStr = String(expected);
		return value.some((item) => item === expectedStr);
	}
	if (typeof value === "string") {
		return value === String(expected);
	}
	if (typeof value === "number") {
		if (typeof expected === "number") {
			return value === expected;
		}
		if (typeof expected === "string") {
			return String(value) === expected;
		}
		return false;
	}
	if (typeof value === "boolean") {
		if (typeof expected === "boolean") {
			return value === expected;
		}
		if (typeof expected === "string") {
			return String(value) === expected;
		}
		return false;
	}
	return false;
}

function matchesContains(
	value: FileProperties[string] | undefined,
	expected: PropertyFilter["value"],
): boolean {
	if (value === undefined || value === null || expected === undefined) {
		return false;
	}
	const expectedStr = String(expected);
	if (Array.isArray(value)) {
		return value.some((item) => item === expectedStr);
	}
	if (typeof value === "string") {
		return value.includes(expectedStr);
	}
	return false;
}
