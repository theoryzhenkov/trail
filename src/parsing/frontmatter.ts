import {ParsedRelation} from "../types";
import {dedupeRelations, extractWikiLinkTarget, isValidRelationName, normalizeRelationName} from "./index";

type FrontmatterValue = string | string[] | null | undefined;

export function parseFrontmatterRelations(frontmatter: Record<string, unknown> | undefined): ParsedRelation[] {
	if (!frontmatter) {
		return [];
	}

	const relations: ParsedRelation[] = [];

	const relationsMap = frontmatter.relations;
	if (relationsMap && typeof relationsMap === "object" && !Array.isArray(relationsMap)) {
		for (const [key, value] of Object.entries(relationsMap as Record<string, FrontmatterValue>)) {
			relations.push(...parseRelationEntry(key, value));
		}
	}

	for (const [key, value] of Object.entries(frontmatter)) {
		if (!key.startsWith("relations.")) {
			continue;
		}
		const relationName = key.slice("relations.".length);
		relations.push(...parseRelationEntry(relationName, value as FrontmatterValue));
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
