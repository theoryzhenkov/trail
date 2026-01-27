/**
 * Frontmatter parsing for relations and file properties.
 *
 * @see docs/syntax/frontmatter.md
 */

import {FileProperties, ParsedRelation, RelationDefinition} from "../types";
import {dedupeRelations, extractWikiLinkTarget, isValidRelationName, normalizeRelationName} from "./index";

type FrontmatterValue = string | string[] | null | undefined;

export function parseFrontmatterRelations(
	frontmatter: Record<string, unknown> | undefined,
	relationDefinitions: RelationDefinition[]
): ParsedRelation[] {
	if (!frontmatter) {
		return [];
	}

	const relations: ParsedRelation[] = [];
	const relationAliases = buildRelationAliases(relationDefinitions);
	const frontmatterLowercase = normalizeFrontmatterKeys(frontmatter);

	for (const [relationName, aliasKeys] of relationAliases.entries()) {
		for (const aliasKey of aliasKeys) {
			const value = resolveAliasValue(aliasKey, frontmatter, frontmatterLowercase);
			if (value !== undefined) {
				relations.push(...parseRelationEntry(relationName, value));
			}
		}
	}

	return dedupeRelations(relations);
}

/**
 * Resolve alias value based on syntax:
 * - Quoted ("key.name") → literal property lookup
 * - Contains dot (parent.key) → nested object lookup
 * - Simple (key) → direct property lookup
 */
function resolveAliasValue(
	aliasKey: string,
	frontmatter: Record<string, unknown>,
	frontmatterLowercase: Map<string, FrontmatterValue>
): FrontmatterValue {
	// Quoted string: literal property lookup
	if (aliasKey.startsWith('"') && aliasKey.endsWith('"')) {
		const literalKey = aliasKey.slice(1, -1).toLowerCase();
		return frontmatterLowercase.get(literalKey);
	}

	// Contains dot: nested object lookup
	const dotIndex = aliasKey.indexOf(".");
	if (dotIndex !== -1) {
		const parentKey = aliasKey.slice(0, dotIndex).toLowerCase();
		const childKey = aliasKey.slice(dotIndex + 1).toLowerCase();
		const parentValue = frontmatter[parentKey] ?? frontmatter[Object.keys(frontmatter).find(k => k.toLowerCase() === parentKey) ?? ""];
		
		if (parentValue && typeof parentValue === "object" && !Array.isArray(parentValue)) {
			const parentObj = parentValue as Record<string, unknown>;
			const matchingKey = Object.keys(parentObj).find(k => k.toLowerCase() === childKey);
			if (matchingKey) {
				return parentObj[matchingKey] as FrontmatterValue;
			}
		}
		return undefined;
	}

	// Simple: direct property lookup
	return frontmatterLowercase.get(aliasKey);
}

export function parseFileProperties(
	frontmatter: Record<string, unknown> | undefined,
	excludeKeys: Set<string>
): FileProperties {
	if (!frontmatter) {
		return {};
	}

	const properties: FileProperties = {};
	const frontmatterLowercase = normalizeFrontmatterKeys(frontmatter);
	const excluded = new Set<string>([...excludeKeys, "relations"]);

	for (const [key, value] of frontmatterLowercase.entries()) {
		if (excluded.has(key)) {
			continue;
		}
		if (value === undefined) {
			continue;
		}
		if (value === null) {
			properties[key] = null;
			continue;
		}
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			properties[key] = value;
			continue;
		}
		if (Array.isArray(value)) {
			const strings = value.filter((item): item is string => typeof item === "string");
			if (strings.length > 0) {
				properties[key] = strings;
			}
		}
	}

	return properties;
}

function parseRelationEntry(relationName: string, value: FrontmatterValue): ParsedRelation[] {
	const relation = normalizeRelationName(relationName);
	if (!isValidRelationName(relation)) {
		return [];
	}

	const values = normalizeValues(value);
	return values
		.map((rawTarget) => extractWikiLinkTarget(rawTarget))
		.filter((target) => target.length > 0)
		.map((target) => ({relation, target}));
}

function normalizeValues(value: FrontmatterValue): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string");
	}
	if (typeof value === "string") {
		return [value];
	}
	return [];
}

function buildRelationAliases(relations: RelationDefinition[]): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const relation of relations) {
		const name = normalizeRelationName(relation.name);
		if (!isValidRelationName(name)) {
			continue;
		}
		const aliasKeys = relation.aliases.map((alias) => alias.key.toLowerCase());
		map.set(name, aliasKeys);
	}
	return map;
}

function normalizeFrontmatterKeys(frontmatter: Record<string, unknown>): Map<string, FrontmatterValue> {
	const map = new Map<string, FrontmatterValue>();
	for (const [key, value] of Object.entries(frontmatter)) {
		map.set(key.toLowerCase(), value as FrontmatterValue);
	}
	return map;
}

