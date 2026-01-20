/**
 * TQL Migration - Convert legacy RelationGroup to TQL queries
 */

import type {
	GroupDefinition,
	RelationGroup,
	PropertyFilter,
	PropertySortKey,
	ChainSortMode,
} from "../types";

/**
 * Convert a legacy RelationGroup to a TQL GroupDefinition
 */
export function migrateGroup(group: RelationGroup): GroupDefinition {
	const query = groupToTql(group);
	return {
		query,
		enabled: true,
	};
}

/**
 * Convert all legacy groups to TQL GroupDefinitions
 */
export function migrateAllGroups(groups: RelationGroup[]): GroupDefinition[] {
	return groups.map(migrateGroup);
}

/**
 * Generate TQL query string from a RelationGroup
 */
export function groupToTql(group: RelationGroup): string {
	const lines: string[] = [];

	// GROUP clause
	lines.push(`group "${escapeString(group.name || "Unnamed")}"`);

	// FROM clause
	const fromParts = group.members.map((member) => {
		let part = member.relation;
		if (member.depth > 0) {
			part += ` depth ${member.depth}`;
		}
		if (member.extend) {
			part += ` extend ${member.extend}`;
		}
		return part;
	});

	if (fromParts.length > 0) {
		lines.push(`from ${fromParts.join(", ")}`);
	} else {
		lines.push("from up depth 1"); // Fallback
	}

	// WHERE clause (from filters)
	if (group.filters && group.filters.length > 0) {
		const whereExpr = filtersToExpr(group.filters, group.filtersMatchMode ?? "all");
		if (whereExpr) {
			lines.push(`where ${whereExpr}`);
		}
	}

	// WHEN clause (from showConditions)
	if (group.showConditions && group.showConditions.length > 0) {
		const whenExpr = filtersToExpr(group.showConditions, group.showConditionsMatchMode ?? "all");
		if (whenExpr) {
			lines.push(`when ${whenExpr}`);
		}
	}

	// SORT clause
	if ((group.sortBy && group.sortBy.length > 0) || group.chainSort) {
		const sortExpr = sortToExpr(group.sortBy ?? [], group.chainSort ?? "disabled");
		if (sortExpr) {
			lines.push(`sort ${sortExpr}`);
		}
	}

	// DISPLAY clause
	if (group.displayProperties && group.displayProperties.length > 0) {
		const displayExpr = group.displayProperties.join(", ");
		lines.push(`display ${displayExpr}`);
	}

	return lines.join("\n");
}

/**
 * Convert property filters to TQL expression
 */
function filtersToExpr(filters: PropertyFilter[], matchMode: "all" | "any"): string | null {
	const exprs = filters.map(filterToExpr).filter((e): e is string => e !== null);

	if (exprs.length === 0) {
		return null;
	}

	if (exprs.length === 1) {
		return exprs[0] ?? null;
	}

	const op = matchMode === "all" ? " and " : " or ";
	return exprs.join(op);
}

/**
 * Convert single property filter to TQL expression
 */
function filterToExpr(filter: PropertyFilter): string | null {
	const key = propertyKeyToTql(filter.key);

	switch (filter.operator) {
		case "equals":
			if (filter.value === undefined || filter.value === null) {
				return `${key} = null`;
			}
			if (typeof filter.value === "string") {
				return `${key} = "${escapeString(filter.value)}"`;
			}
			if (typeof filter.value === "boolean") {
				return `${key} = ${filter.value}`;
			}
			return `${key} = ${filter.value}`;

		case "contains":
			if (typeof filter.value === "string") {
				return `contains(${key}, "${escapeString(filter.value)}")`;
			}
			return null;

		case "exists":
			return `exists(${key})`;

		case "notExists":
			return `not exists(${key})`;

		default:
			return null;
	}
}

/**
 * Convert sort configuration to TQL expression
 */
function sortToExpr(sortBy: PropertySortKey[], chainSort: ChainSortMode): string | null {
	const parts: string[] = [];

	if (chainSort === "primary") {
		parts.push("$chain");
	}

	for (const sort of sortBy) {
		const key = propertyKeyToTql(sort.property);
		if (sort.direction === "desc") {
			parts.push(`${key} desc`);
		} else {
			parts.push(key);
		}
	}

	if (chainSort === "secondary" && parts.length > 0) {
		parts.push("$chain");
	}

	return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Convert a property key to TQL syntax.
 * Uses $file.properties.* for all property access.
 * Uses quoted segments for keys with characters invalid in identifiers.
 */
function propertyKeyToTql(key: string): string {
	// Each part of a dot-separated path is either a valid identifier or needs quoting
	const parts = key.split(".");
	const segments = parts.map(part => 
		isValidIdentifier(part) ? part : `"${escapeString(part)}"`
	);
	
	return `$file.properties.${segments.join(".")}`;
}

/**
 * Check if a string is a valid TQL identifier
 */
function isValidIdentifier(key: string): boolean {
	// Reserved keywords
	const reserved = new Set([
		"group", "from", "depth", "unlimited", "extend", "prune", "where", "when",
		"sort", "asc", "desc", "display", "all", "and", "or", "not",
		"in", "true", "false", "null", "today", "yesterday", "tomorrow",
		"startOfWeek", "endOfWeek"
	]);

	if (reserved.has(key)) {
		return false;
	}

	// Must match identifier pattern (allow Unicode letters, numbers, and symbols)
	// \p{L} = Letters, \p{N} = Numbers, \p{So} = Other Symbols, \p{Sc} = Currency Symbols
	if (!/^[\p{L}\p{So}\p{Sc}_][\p{L}\p{N}\p{So}\p{Sc}_-]*$/u.test(key)) {
		return false;
	}

	return true;
}

/**
 * Escape string for TQL string literal
 */
function escapeString(str: string): string {
	return str
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\t/g, "\\t");
}

/**
 * Migration result with potential warnings
 */
export interface MigrationResult {
	groups: GroupDefinition[];
	warnings: MigrationWarning[];
}

export interface MigrationWarning {
	groupName: string;
	message: string;
}

/**
 * Migrate groups with warnings for unconvertible features
 */
export function migrateWithWarnings(groups: RelationGroup[]): MigrationResult {
	const result: MigrationResult = {
		groups: [],
		warnings: [],
	};

	for (const group of groups) {
		const definition = migrateGroup(group);
		result.groups.push(definition);

		// Check for features that may not convert perfectly
		if (group.filters?.some((f) => f.operator !== "equals" && f.operator !== "exists" && f.operator !== "notExists")) {
			result.warnings.push({
				groupName: group.name,
				message: "Some filter operators may not convert exactly",
			});
		}
	}

	return result;
}
