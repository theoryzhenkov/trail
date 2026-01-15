import {ParsedRelation} from "../types";
import {dedupeRelations, extractLinkTarget, isValidRelationName, normalizeRelationName} from "./index";

const PREFIX_REGEX = /([a-z0-9_-]+)::\s*\[\[([^\]]+)\]\]/gi;
const SUFFIX_REGEX = /\[\[([^\]]+)\]\]::\s*([a-z0-9_-]+)/gi;

export function parseInlineRelations(content: string): ParsedRelation[] {
	const relations: ParsedRelation[] = [];

	for (const match of content.matchAll(PREFIX_REGEX)) {
		const rawRelation = match[1];
		const rawTarget = match[2];
		if (!rawRelation || !rawTarget) {
			continue;
		}
		const relation = normalizeRelationName(rawRelation);
		if (!isValidRelationName(relation)) {
			continue;
		}
		const target = extractLinkTarget(rawTarget);
		if (target.length === 0) {
			continue;
		}
		relations.push({relation, target});
	}

	for (const match of content.matchAll(SUFFIX_REGEX)) {
		const rawTarget = match[1];
		const rawRelation = match[2];
		if (!rawRelation || !rawTarget) {
			continue;
		}
		const relation = normalizeRelationName(rawRelation);
		if (!isValidRelationName(relation)) {
			continue;
		}
		const target = extractLinkTarget(rawTarget);
		if (target.length === 0) {
			continue;
		}
		relations.push({relation, target});
	}

	return dedupeRelations(relations);
}
