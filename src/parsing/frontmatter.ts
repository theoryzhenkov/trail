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
	const relationsMap = frontmatter.relations;
	const relationsMapEntries = normalizeRelationsMap(relationsMap);

	for (const [relationName, aliases] of relationAliases.entries()) {
		for (const alias of aliases) {
			if (alias.type === "relationsMap") {
				const value = relationsMapEntries.get(alias.key);
				if (value !== undefined) {
					relations.push(...parseRelationEntry(relationName, value));
				}
				continue;
			}

			const value = frontmatterLowercase.get(alias.key);
			if (value !== undefined) {
				relations.push(...parseRelationEntry(relationName, value));
			}
		}
	}

	return dedupeRelations(relations);
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

function buildRelationAliases(relations: RelationDefinition[]): Map<string, RelationDefinition["aliases"]> {
	const map = new Map<string, RelationDefinition["aliases"]>();
	for (const relation of relations) {
		const name = normalizeRelationName(relation.name);
		if (!isValidRelationName(name)) {
			continue;
		}
		const aliases = relation.aliases.map((alias) => ({
			type: alias.type,
			key: alias.key.toLowerCase()
		}));
		map.set(name, aliases);
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

function normalizeRelationsMap(relationsMap: unknown): Map<string, FrontmatterValue> {
	const map = new Map<string, FrontmatterValue>();
	if (!relationsMap || typeof relationsMap !== "object" || Array.isArray(relationsMap)) {
		return map;
	}
	for (const [key, value] of Object.entries(relationsMap as Record<string, FrontmatterValue>)) {
		map.set(key.toLowerCase(), value);
	}
	return map;
}
