import {ParsedRelation} from "../types";
import {dedupeRelations, extractWikiLinkTarget, isValidRelationName, normalizeRelationName} from "./index";

type FrontmatterValue = string | string[] | null | undefined;

export function parseFrontmatterRelations(
	frontmatter: Record<string, unknown> | undefined,
	relationProperties: string[]
): ParsedRelation[] {
	if (!frontmatter) {
		return [];
	}

	const relations: ParsedRelation[] = [];
	const relationPropertiesSet = new Set(relationProperties.map((p) => p.toLowerCase()));

	// Parse `relations` map: relations: { up: [...] }
	const relationsMap = frontmatter.relations;
	if (relationsMap && typeof relationsMap === "object" && !Array.isArray(relationsMap)) {
		for (const [key, value] of Object.entries(relationsMap as Record<string, FrontmatterValue>)) {
			relations.push(...parseRelationEntry(key, value));
		}
	}

	// Parse `relations.up` dot properties
	for (const [key, value] of Object.entries(frontmatter)) {
		if (key.startsWith("relations.")) {
			const relationName = key.slice("relations.".length);
			relations.push(...parseRelationEntry(relationName, value as FrontmatterValue));
			continue;
		}

		// Parse top-level relation properties (e.g., `up`, `down`)
		if (relationPropertiesSet.has(key.toLowerCase())) {
			relations.push(...parseRelationEntry(key, value as FrontmatterValue));
		}
	}

	return dedupeRelations(relations);
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
