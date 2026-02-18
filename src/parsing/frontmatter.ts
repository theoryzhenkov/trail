/**
 * Frontmatter parsing for relations and file properties.
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
			const wildcard = parseWildcardAlias(aliasKey);
			if (wildcard) {
				resolveWildcardRelations(
					frontmatter,
					wildcard,
					relationName,
					relations,
				);
				continue;
			}

			const value = resolveAliasValue(aliasKey, frontmatterLowercase);
			if (value === undefined) continue;

			if (
				typeof value === "object" &&
				value !== null &&
				!Array.isArray(value)
			) {
				// Object value → each key is a label
				for (const [label, subValue] of Object.entries(value)) {
					if (!isValidLabel(label)) continue;
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
		if (!knownRelations.has(prefix) || !isValidLabel(label)) continue;
		// Skip if this exact key was already consumed via alias resolution
		if (consumedKeys.has(key)) continue;
		const value = frontmatterLowercase.get(key) as FrontmatterValue;
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
	frontmatterLowercase: Map<string, unknown>,
): unknown {
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
		const parentValue = frontmatterLowercase.get(parentKey);

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
				return parentObj[matchingKey];
			}
		}
		return undefined;
	}

	// Simple: direct property lookup — check for object value (labeled relations)
	const rawValue = frontmatterLowercase.get(aliasKey);
	if (
		rawValue !== undefined &&
		typeof rawValue === "object" &&
		rawValue !== null &&
		!Array.isArray(rawValue)
	) {
		return rawValue as Record<string, unknown>;
	}

	return rawValue;
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
): Map<string, unknown> {
	const map = new Map<string, unknown>();
	for (const [key, value] of Object.entries(frontmatter)) {
		map.set(key.toLowerCase(), value);
	}
	return map;
}

// ── Wildcard alias support ──────────────────────────────────────────

interface WildcardAlias {
	prefix: string[]; // e.g. ["type", "book"] for "type.book.*KEY"
	key: string; // target key (lowercase)
	quoted: boolean; // true = dot-notation matching
	labelFilter: string[] | undefined; // label restriction (undefined = all)
}

interface WildcardMatch {
	value: unknown;
	label?: string;
}

/**
 * Parse an alias key into a WildcardAlias if it contains `*`.
 * Returns undefined for non-wildcard aliases.
 *
 * Supported syntaxes:
 *   *KEY, *KEY.LABEL, *KEY.{L1, L2}
 *   PREFIX.*KEY, PREFIX.*KEY.LABEL
 *   *"KEY.LABEL", *"KEY.{L1, L2}", PREFIX.*"KEY.LABEL"
 */
function parseWildcardAlias(aliasKey: string): WildcardAlias | undefined {
	const starIdx = aliasKey.indexOf("*");
	if (starIdx === -1) return undefined;

	// Extract prefix segments (everything before *)
	const prefixPart = aliasKey.slice(0, starIdx);
	const prefix: string[] = prefixPart
		? prefixPart
				.replace(/\.$/, "") // remove trailing dot
				.split(".")
				.map((s) => s.toLowerCase())
		: [];

	const afterStar = aliasKey.slice(starIdx + 1);

	// Quoted form: *"KEY.LABEL" or *"KEY.{L1, L2}"
	if (afterStar.startsWith('"') && afterStar.endsWith('"')) {
		const inner = afterStar.slice(1, -1);
		const { key, labelFilter } = parseKeyWithLabels(inner);
		return { prefix, key: key.toLowerCase(), quoted: true, labelFilter };
	}

	// Unquoted form: *KEY, *KEY.LABEL, *KEY.{L1, L2}
	return parseUnquotedAfterStar(afterStar, prefix);
}

/**
 * Parse "KEY", "KEY.LABEL", or "KEY.{L1, L2}" into key + label filter.
 * Shared by both quoted and unquoted alias parsing paths.
 */
function parseKeyWithLabels(input: string): {
	key: string;
	labelFilter: string[] | undefined;
} {
	// Set syntax: KEY.{L1, L2}
	const braceIdx = input.indexOf(".{");
	if (braceIdx !== -1 && input.endsWith("}")) {
		const key = input.slice(0, braceIdx);
		const labels = input
			.slice(braceIdx + 2, -1)
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter((s) => s.length > 0);
		return { key, labelFilter: labels };
	}

	// Single label: KEY.LABEL
	const dotIdx = input.indexOf(".");
	if (dotIdx !== -1) {
		return {
			key: input.slice(0, dotIdx),
			labelFilter: [input.slice(dotIdx + 1).toLowerCase()],
		};
	}

	return { key: input, labelFilter: undefined };
}

function parseUnquotedAfterStar(
	afterStar: string,
	prefix: string[],
): WildcardAlias {
	const { key, labelFilter } = parseKeyWithLabels(afterStar);
	return {
		prefix,
		key: key.toLowerCase(),
		quoted: false,
		labelFilter,
	};
}

/**
 * Walk a tree looking for keys matching targetKey (object-notation / unquoted).
 * Object values → children become labeled matches.
 * Scalar/array → unlabeled match.
 */
function walkTreeUnquoted(
	node: unknown,
	targetKey: string,
	matches: WildcardMatch[],
): void {
	if (Array.isArray(node)) {
		for (const element of node) {
			walkTreeUnquoted(element, targetKey, matches);
		}
		return;
	}

	if (typeof node !== "object" || node === null) return;

	const obj = node as Record<string, unknown>;
	for (const [k, v] of Object.entries(obj)) {
		if (k.toLowerCase() === targetKey) {
			// Found target key — process its value
			if (typeof v === "object" && v !== null && !Array.isArray(v)) {
				// Object → each child key is a label
				for (const [childKey, childValue] of Object.entries(
					v as Record<string, unknown>,
				)) {
					matches.push({
						value: childValue,
						label: childKey.toLowerCase(),
					});
				}
			} else {
				// Scalar or array → unlabeled
				matches.push({ value: v });
			}
		} else {
			// Recurse into children
			walkTreeUnquoted(v, targetKey, matches);
		}
	}
}

/**
 * Walk a tree looking for literal dot-keys (quoted / dot-notation).
 * literalKeys is the set of full dot-keys to match (e.g. ["ntppi.author"]).
 * targetKey is the base key (e.g. "ntppi") used to compute label from suffix.
 */
function walkTreeQuoted(
	node: unknown,
	targetKey: string,
	literalKeys: string[],
	matches: WildcardMatch[],
): void {
	if (Array.isArray(node)) {
		for (const element of node) {
			walkTreeQuoted(element, targetKey, literalKeys, matches);
		}
		return;
	}

	if (typeof node !== "object" || node === null) return;

	const obj = node as Record<string, unknown>;
	for (const [k, v] of Object.entries(obj)) {
		const keyLower = k.toLowerCase();
		const matchedLiteral = literalKeys.find((lk) => lk === keyLower);
		if (matchedLiteral) {
			// Extract label from the part after the base key + "."
			const suffix = matchedLiteral.slice(targetKey.length + 1);
			matches.push({
				value: v,
				label: suffix.length > 0 ? suffix : undefined,
			});
		} else {
			walkTreeQuoted(v, targetKey, literalKeys, matches);
		}
	}
}

/**
 * Resolve matches for a wildcard alias against raw frontmatter.
 * Descends through prefix segments, then dispatches to the appropriate walk.
 */
function resolveWildcardMatches(
	frontmatter: Record<string, unknown>,
	wildcard: WildcardAlias,
): WildcardMatch[] {
	// Navigate through prefix
	let node: unknown = frontmatter;
	for (const segment of wildcard.prefix) {
		if (typeof node !== "object" || node === null || Array.isArray(node))
			return [];
		const obj = node as Record<string, unknown>;
		const matchingKey = Object.keys(obj).find(
			(k) => k.toLowerCase() === segment,
		);
		if (!matchingKey) return [];
		node = obj[matchingKey];
	}

	const matches: WildcardMatch[] = [];

	if (wildcard.quoted) {
		// Build literal keys from base key + label filter
		let literalKeys: string[];
		if (wildcard.labelFilter) {
			literalKeys = wildcard.labelFilter.map(
				(label) => `${wildcard.key}.${label}`,
			);
		} else {
			literalKeys = [wildcard.key];
		}
		walkTreeQuoted(node, wildcard.key, literalKeys, matches);
	} else {
		walkTreeUnquoted(node, wildcard.key, matches);
	}

	return matches;
}

/**
 * Convert wildcard matches to ParsedRelations.
 * Applies label filter and delegates to parseRelationEntry.
 */
function resolveWildcardRelations(
	frontmatter: Record<string, unknown>,
	wildcard: WildcardAlias,
	relationName: string,
	relations: ParsedRelation[],
): void {
	let matches = resolveWildcardMatches(frontmatter, wildcard);

	// Apply label filter for unquoted (object-notation) aliases
	if (!wildcard.quoted && wildcard.labelFilter) {
		const allowed = new Set(wildcard.labelFilter);
		matches = matches.filter(
			(m) => m.label !== undefined && allowed.has(m.label),
		);
	}

	for (const match of matches) {
		relations.push(
			...parseRelationEntry(
				relationName,
				match.value as FrontmatterValue,
				match.label,
			),
		);
	}
}
