/**
 * Frontmatter parsing for relations and file properties.
 *
 * @see docs/syntax/frontmatter.md
 */

import { FileProperties, ParsedRelation, RelationDefinition } from "../types";
import {
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

export function parseFrontmatterRelations(
	frontmatter: Record<string, unknown> | undefined,
	relationDefinitions: RelationDefinition[],
): FrontmatterRelationResult {
	if (!frontmatter) {
		return { relations: [], consumedKeys: new Set() };
	}

	const relations: ParsedRelation[] = [];
	const consumedKeys = new Set<string>();
	const relationAliases = buildRelationAliases(relationDefinitions);
	const frontmatterLowercase = normalizeFrontmatterKeys(frontmatter);

	for (const [relationName, aliasKeys] of relationAliases.entries()) {
		for (const aliasKey of aliasKeys) {
			const value = resolveAliasValue(
				aliasKey,
				frontmatter,
				frontmatterLowercase,
			);
			if (value === undefined) continue;

			if (
				typeof value === "object" &&
				value !== null &&
				!Array.isArray(value)
			) {
				// Object value → each key is a label
				for (const [label, subValue] of Object.entries(value)) {
					relations.push(
						...parseRelationEntry(
							relationName,
							subValue as FrontmatterValue,
							label,
						),
					);
				}
				consumedKeys.add(aliasKey);
			} else {
				relations.push(
					...parseRelationEntry(
						relationName,
						value as FrontmatterValue,
					),
				);
			}
		}
	}

	// Dot-key scanning: "up.author" as a literal frontmatter key
	const knownRelations = new Set(relationAliases.keys());
	for (const [key] of frontmatterLowercase.entries()) {
		const dotIdx = key.indexOf(".");
		if (dotIdx === -1) continue;
		const prefix = key.slice(0, dotIdx);
		const label = key.slice(dotIdx + 1);
		if (!knownRelations.has(prefix) || !label) continue;
		// Skip if this exact key was already consumed via alias resolution
		if (consumedKeys.has(key)) continue;
		const value = frontmatterLowercase.get(key);
		relations.push(...parseRelationEntry(prefix, value, label));
		consumedKeys.add(key);
	}

	return { relations: dedupeRelations(relations), consumedKeys };
}

/**
 * Resolve alias value based on syntax:
 * - Quoted ("key.name") → literal property lookup
 * - Contains dot (parent.key) → nested object lookup
 * - Simple (key) → direct property lookup
 *
 * Returns FrontmatterValue for scalars/arrays, or Record<string, unknown> for objects (labeled relations).
 */
function resolveAliasValue(
	aliasKey: string,
	frontmatter: Record<string, unknown>,
	frontmatterLowercase: Map<string, FrontmatterValue>,
): FrontmatterValue | Record<string, unknown> {
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
		const parentValue =
			frontmatter[parentKey] ??
			frontmatter[
				Object.keys(frontmatter).find(
					(k) => k.toLowerCase() === parentKey,
				) ?? ""
			];

		if (
			parentValue &&
			typeof parentValue === "object" &&
			!Array.isArray(parentValue)
		) {
			const parentObj = parentValue as Record<string, unknown>;
			const matchingKey = Object.keys(parentObj).find(
				(k) => k.toLowerCase() === childKey,
			);
			if (matchingKey) {
				return parentObj[matchingKey] as FrontmatterValue;
			}
		}
		return undefined;
	}

	// Simple: direct property lookup — check for object value (labeled relations)
	const rawValue =
		frontmatter[
			Object.keys(frontmatter).find(
				(k) => k.toLowerCase() === aliasKey,
			) ?? ""
		];
	if (
		rawValue !== undefined &&
		typeof rawValue === "object" &&
		rawValue !== null &&
		!Array.isArray(rawValue)
	) {
		return rawValue as Record<string, unknown>;
	}

	return frontmatterLowercase.get(aliasKey);
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

function parseRelationEntry(
	relationName: string,
	value: FrontmatterValue,
	label?: string,
): ParsedRelation[] {
	const relation = normalizeRelationName(relationName);
	if (!isValidRelationName(relation)) {
		return [];
	}
	const normalizedLabel = label ? normalizeLabel(label) : undefined;

	const values = normalizeValues(value);
	return values
		.map((rawTarget) => extractWikiLinkTarget(rawTarget))
		.filter((target) => target.length > 0)
		.map((target) => ({
			relation,
			...(normalizedLabel && { label: normalizedLabel }),
			target,
		}));
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

function buildRelationAliases(
	relations: RelationDefinition[],
): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const relation of relations) {
		const normalizedName = normalizeRelationName(relation.name);
		if (!isValidRelationName(normalizedName)) {
			continue;
		}
		const aliasKeys = relation.aliases.map((alias) =>
			alias.key.toLowerCase(),
		);
		map.set(normalizedName, aliasKeys);
	}
	return map;
}

function normalizeFrontmatterKeys(
	frontmatter: Record<string, unknown>,
): Map<string, FrontmatterValue> {
	const map = new Map<string, FrontmatterValue>();
	for (const [key, value] of Object.entries(frontmatter)) {
		map.set(key.toLowerCase(), value as FrontmatterValue);
	}
	return map;
}
