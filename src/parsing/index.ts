import {ParsedRelation} from "../types";

// Relation names must start with alphanumeric, can contain _, -
// This prevents "-" alone from being a valid relation (used in chain syntax ::-::)
export const RELATION_NAME_REGEX = /^[a-z0-9][a-z0-9_-]*$/i;

export function normalizeRelationName(name: string): string {
	return name.trim().toLowerCase();
}

export function isValidRelationName(name: string): boolean {
	return RELATION_NAME_REGEX.test(name);
}

export function extractLinkTarget(raw: string): string {
	const withoutAlias = raw.split("|")[0] ?? raw;
	const withoutHeading = withoutAlias.split("#")[0] ?? withoutAlias;
	return withoutHeading.trim();
}

export function extractWikiLinkTarget(raw: string): string {
	const match = raw.match(/\[\[([^\]]+)\]\]/);
	if (!match || !match[1]) {
		return raw.trim();
	}
	return extractLinkTarget(match[1]);
}

export function dedupeRelations(relations: ParsedRelation[]): ParsedRelation[] {
	const seen = new Set<string>();
	const deduped: ParsedRelation[] = [];
	for (const relation of relations) {
		// Both source and target can be undefined (meaning currentFile)
		const key = `${relation.source ?? ""}::${relation.relation}::${relation.target ?? ""}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduped.push(relation);
	}
	return deduped;
}
