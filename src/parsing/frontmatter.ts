/**
 * Frontmatter parsing for relations and file properties.
 *
 * Keys match at any depth of YAML nesting via full tree walk.
 * Labels are hierarchical dot-separated paths built from intermediate object keys.
 *
 * @see docs/syntax/frontmatter.md
 */

import { FileProperties, ParsedRelation, RelationDefinition } from "../types";
import {
	isValidLabel,
	isValidRelationName,
	normalizeLabel,
	normalizeRelationName,
} from "../relations";
import { dedupeRelations, extractWikiLinkTarget } from "./index";

type FrontmatterValue = string | string[] | null | undefined;

export interface FrontmatterRelationResult {
	relations: ParsedRelation[];
	consumedKeys: Set<string>;
}

/** A match found by the tree walk */
interface KeyMatch {
	value: unknown;
	/** Label segments derived from dot-notation prefix (e.g. "up.author" → ["author"]) */
	labelPrefix: string[];
}

/**
 * Parse frontmatter relations using simple key matching at any depth.
 *
 * For each relation definition, each alias key is searched through the entire
 * frontmatter tree. Exact key matches and dot-notation prefix matches are found.
 * Values are recursively descended to build hierarchical label paths from
 * intermediate object keys.
 */
export function parseFrontmatterRelations(
	frontmatter: Record<string, unknown> | undefined,
	relationDefinitions: RelationDefinition[],
): FrontmatterRelationResult {
	if (!frontmatter) {
		return { relations: [], consumedKeys: new Set() };
	}

	const relations: ParsedRelation[] = [];
	const consumedKeys = new Set<string>();

	// Build a map of relation name → alias keys
	const relationKeyMap = buildRelationKeyMap(relationDefinitions);

	// Track which key names are used by relations for consumedKeys
	const allKeyNames = new Set<string>();
	for (const keySet of relationKeyMap.values()) {
		for (const key of keySet) {
			allKeyNames.add(key);
		}
	}

	// Collect consumed top-level frontmatter keys
	for (const fmKey of Object.keys(frontmatter)) {
		const fmKeyLower = fmKey.toLowerCase();
		if (allKeyNames.has(fmKeyLower)) {
			consumedKeys.add(fmKeyLower);
		} else {
			// Check dot-notation prefix: "up.author" consumed if "up" is a key
			const dotIdx = fmKeyLower.indexOf(".");
			if (dotIdx !== -1) {
				const prefix = fmKeyLower.slice(0, dotIdx);
				if (allKeyNames.has(prefix)) {
					consumedKeys.add(fmKeyLower);
				}
			}
		}
	}

	for (const [relationName, keyNames] of relationKeyMap.entries()) {
		for (const keyName of keyNames) {
			const matches: KeyMatch[] = [];
			findKeyMatches(frontmatter, keyName, matches);

			for (const match of matches) {
				extractWikilinks(
					match.value,
					match.labelPrefix,
					relations,
					relationName,
				);
			}
		}
	}

	return { relations: dedupeRelations(relations), consumedKeys };
}

/**
 * Build a map from normalized relation name to set of alias key names (lowercase).
 */
function buildRelationKeyMap(
	relations: RelationDefinition[],
): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();
	for (const relation of relations) {
		const normalizedName = normalizeRelationName(relation.name);
		if (!isValidRelationName(normalizedName)) continue;
		const keys = new Set<string>();
		for (const alias of relation.aliases) {
			keys.add(alias.key.toLowerCase());
		}
		map.set(normalizedName, keys);
	}
	return map;
}

/**
 * Walk the entire frontmatter tree looking for a key name.
 *
 * At each object node:
 * 1. Check if any key matches keyName exactly (case-insensitive)
 * 2. Check if any key starts with `keyName.` (dot notation) — suffix becomes initial label segments
 * 3. Recurse into child objects/arrays for deeper matches
 */
function findKeyMatches(
	node: unknown,
	keyName: string,
	matches: KeyMatch[],
): void {
	if (Array.isArray(node)) {
		for (const element of node) {
			findKeyMatches(element, keyName, matches);
		}
		return;
	}

	if (typeof node !== "object" || node === null) return;

	const obj = node as Record<string, unknown>;
	for (const [k, v] of Object.entries(obj)) {
		const keyLower = k.toLowerCase();

		if (keyLower === keyName) {
			// Exact match
			matches.push({ value: v, labelPrefix: [] });
		} else if (keyLower.startsWith(keyName + ".")) {
			// Dot-notation match: "up.author" with keyName "up" → labelPrefix ["author"]
			const suffix = keyLower.slice(keyName.length + 1);
			const segments = suffix.split(".");
			if (segments.every((s) => s.length > 0)) {
				matches.push({ value: v, labelPrefix: segments });
			}
		} else {
			// Recurse into children for deeper matches
			findKeyMatches(v, keyName, matches);
		}
	}
}

/**
 * Recursively extract wikilinks from a value, building label paths from
 * intermediate object keys.
 *
 * - If value is an object, each key becomes a label segment; recurse into values
 * - If value is a string or string[], extract wikilink targets as leaf relations
 */
function extractWikilinks(
	value: unknown,
	labelPath: string[],
	relations: ParsedRelation[],
	relationName: string,
): void {
	if (typeof value === "string") {
		const target = extractWikiLinkTarget(value);
		if (target.length > 0) {
			pushRelation(relations, relationName, labelPath, target);
		}
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			if (typeof item === "string") {
				const target = extractWikiLinkTarget(item);
				if (target.length > 0) {
					pushRelation(relations, relationName, labelPath, target);
				}
			}
		}
		return;
	}

	if (typeof value === "object" && value !== null) {
		const obj = value as Record<string, unknown>;
		for (const [k, v] of Object.entries(obj)) {
			const segment = k.toLowerCase();
			if (!isValidLabel(segment)) continue;
			extractWikilinks(
				v,
				[...labelPath, segment],
				relations,
				relationName,
			);
		}
	}
}

function pushRelation(
	relations: ParsedRelation[],
	relationName: string,
	labelPath: string[],
	target: string,
): void {
	const relation = normalizeRelationName(relationName);
	if (!isValidRelationName(relation)) return;

	const label =
		labelPath.length > 0 ? normalizeLabel(labelPath.join(".")) : undefined;

	relations.push({
		relation,
		...(label && { label }),
		target,
	});
}

export function parseFileProperties(
	frontmatter: Record<string, unknown> | undefined,
	excludeKeys: Set<string>,
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
		if (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean"
		) {
			properties[key] = value;
			continue;
		}
		if (Array.isArray(value)) {
			const strings = value.filter(
				(item): item is string => typeof item === "string",
			);
			if (strings.length > 0) {
				properties[key] = strings;
			}
		}
	}

	return properties;
}

function normalizeFrontmatterKeys(
	frontmatter: Record<string, unknown>,
): Map<string, unknown> {
	const map = new Map<string, unknown>();
	for (const [key, value] of Object.entries(frontmatter)) {
		map.set(key.toLowerCase(), value);
	}
	return map;
}
