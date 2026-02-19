/**
 * Settings Migration Module
 *
 * Handles all settings format migrations in one place.
 * Migrations run once during buildSettings() and are persisted.
 */

import type {
	RelationDefinition,
	RelationAlias,
	GroupDefinition,
} from "../types";
import {
	migrateAllTqlSyntax,
	needsSyntaxMigration,
} from "../query/syntax-migration";
import { createRelationUid, normalizeRelationName } from "../relations";

/** @deprecated Legacy alias format with type field */
interface LegacyRelationAlias {
	type: "property" | "dotProperty" | "relationsMap";
	key: string;
}

/** @deprecated Legacy relation format with id/displayName */
interface LegacyRelationDefinition {
	uid?: string;
	name?: string;
	id?: string;
	displayName?: string;
}

/**
 * Type for saved settings data (may be in old format)
 */
interface SavedSettingsData {
	tqlGroups?: GroupDefinition[];
	relations?: RelationDefinition[];
	hideEmptyGroups?: boolean;
	editorMode?: "visual" | "query" | "auto";
}

/**
 * Check if saved data has any migrations to apply
 */
export function savedDataNeedsMigration(
	savedData: Partial<SavedSettingsData> | null,
): boolean {
	if (!savedData) return false;

	// Check for TQL syntax needing migration (3.x → 4.x)
	if (Array.isArray(savedData.tqlGroups)) {
		for (const group of savedData.tqlGroups) {
			if (group.query && needsSyntaxMigration(group.query)) {
				return true;
			}
		}
	}

	// Check for legacy alias format or legacy relation shape
	if (Array.isArray(savedData.relations)) {
		// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration checks
		for (const relation of savedData.relations as Array<
			RelationDefinition & LegacyRelationDefinition
		>) {
			if (needsAliasMigration(relation.aliases)) {
				return true;
			}
			if (needsRelationIdentityMigration(relation)) {
				return true;
			}
			if (needsKeySimplification(relation.aliases)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Apply all migrations to saved data in place
 * Returns the migrated data
 */
export function applyMigrations(data: Partial<SavedSettingsData>): {
	tqlGroups: GroupDefinition[];
	relations: RelationDefinition[];
} {
	let tqlGroups = data.tqlGroups ?? [];
	let relations = data.relations ?? [];

	// Auto-migrate TQL syntax from 3.x to 4.x
	migrateAllTqlSyntax(tqlGroups);

	// Auto-migrate legacy alias format
	migrateRelationAliases(relations);

	// Auto-migrate relation identity and implied relation references
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration
	migrateRelationIdentity(
		relations as Array<RelationDefinition & LegacyRelationDefinition>,
	);

	// Simplify old wildcard/complex alias keys to plain keys
	simplifyAliasKeys(relations);

	return { tqlGroups, relations };
}

/**
 * Check if aliases array contains legacy format (with type field)
 */
function needsAliasMigration(aliases: unknown): boolean {
	if (!Array.isArray(aliases)) return false;
	return aliases.some(
		(alias) => alias && typeof alias === "object" && "type" in alias,
	);
}

/**
 * Migrate legacy alias format to new format.
 * Old format: {type: "property"|"dotProperty"|"relationsMap", key: string}
 * New format: {key: string} where:
 *   - "key" → direct property lookup
 *   - "parent.key" → nested object lookup
 *   - '"key.name"' → literal property with dot
 */
function migrateRelationAliases(relations: RelationDefinition[]): void {
	for (const relation of relations) {
		if (!needsAliasMigration(relation.aliases)) {
			continue;
		}

		const migratedAliases: RelationAlias[] = [];
		// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration
		const legacyAliases =
			relation.aliases as unknown as LegacyRelationAlias[];

		for (const alias of legacyAliases) {
			migratedAliases.push({ key: migrateSingleAlias(alias) });
		}

		relation.aliases = migratedAliases;
	}
}

/**
 * Convert a single legacy alias to new format key
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration
function migrateSingleAlias(alias: LegacyRelationAlias): string {
	switch (alias.type) {
		case "property":
			// Direct property: keep as-is
			return alias.key;
		case "dotProperty":
			// Literal dot property: wrap in quotes
			return `"${alias.key}"`;
		case "relationsMap":
			// Nested in relations object: use dot notation
			return `relations.${alias.key}`;
		default:
			// Unknown type: treat as direct property
			return alias.key;
	}
}

// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration checks
function needsRelationIdentityMigration(
	relation: LegacyRelationDefinition,
): boolean {
	const hasUid = typeof relation.uid === "string" && relation.uid.length > 0;
	const hasName =
		typeof relation.name === "string" && relation.name.length > 0;
	const hasLegacyId =
		typeof relation.id === "string" && relation.id.length > 0;
	const hasLegacyDisplayName =
		typeof relation.displayName === "string" &&
		relation.displayName.length > 0;
	if (!hasUid || !hasName) {
		return true;
	}
	if (hasLegacyId || hasLegacyDisplayName) {
		return true;
	}
	return false;
}

function migrateRelationIdentity(
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration
	relations: Array<RelationDefinition & LegacyRelationDefinition>,
): void {
	const uidByLegacyName = new Map<string, string>();

	for (const relation of relations) {
		if (!relation.uid) {
			relation.uid = createRelationUid();
		}

		if (!relation.name || relation.name.trim().length === 0) {
			const migratedName =
				relation.displayName ?? relation.id ?? relation.name ?? "";
			relation.name = migratedName;
		}

		const normalizedLegacyId = normalizeRelationName(
			relation.id ?? relation.name,
		);
		if (normalizedLegacyId) {
			uidByLegacyName.set(normalizedLegacyId, relation.uid);
		}
	}

	for (const relation of relations) {
		for (const implied of relation.impliedRelations as Array<{
			targetRelationUid?: string;
			targetRelation?: string;
		}>) {
			if (!implied.targetRelationUid) {
				const legacyTarget = implied.targetRelation
					? normalizeRelationName(implied.targetRelation)
					: "";
				if (legacyTarget) {
					implied.targetRelationUid =
						uidByLegacyName.get(legacyTarget);
				}
			}
			delete implied.targetRelation;
		}

		delete relation.id;
		delete relation.displayName;
	}
}

// ── Key simplification migration ────────────────────────────────────

/**
 * Check if any alias keys need simplification from old formats.
 * Old formats: wildcards (*KEY, PREFIX.*KEY), quoted ("KEY.LABEL"),
 * relations.X prefix, etc.
 */
function needsKeySimplification(aliases: unknown): boolean {
	if (!Array.isArray(aliases)) return false;
	return aliases.some((alias) => {
		if (!alias || typeof alias !== "object" || !("key" in alias))
			return false;
		const key = (alias as RelationAlias).key;
		return (
			key.includes("*") ||
			(key.startsWith('"') && key.endsWith('"')) ||
			key.startsWith("relations.")
		);
	});
}

/**
 * Simplify old wildcard/complex alias keys to plain keys.
 *
 * Conversions:
 *   *ntppi.author     → ntppi
 *   *"NTPPi.author"   → ntppi
 *   type.*ntppi        → ntppi
 *   "ntppi.author"    → ntppi.author  (strip quotes)
 *   relations.up      → (drop — redundant with "up")
 *
 * After conversion, deduplicate keys.
 */
function simplifyAliasKeys(relations: RelationDefinition[]): void {
	for (const relation of relations) {
		if (!needsKeySimplification(relation.aliases)) continue;

		const seen = new Set<string>();
		const simplified: RelationAlias[] = [];

		for (const alias of relation.aliases) {
			const key = simplifyKey(alias.key);
			if (key === null) continue; // drop
			const lower = key.toLowerCase();
			if (seen.has(lower)) continue;
			seen.add(lower);
			simplified.push({ key: lower });
		}

		relation.aliases = simplified;
	}
}

/**
 * Simplify a single alias key. Returns null to drop it.
 */
function simplifyKey(key: string): string | null {
	// relations.X → X (strip prefix; deduplication handles redundancy)
	if (key.startsWith("relations.")) {
		return key.slice("relations.".length);
	}

	// Strip quotes: "ntppi.author" → ntppi.author
	if (key.startsWith('"') && key.endsWith('"')) {
		return key.slice(1, -1);
	}

	// Wildcard: extract the base key name
	if (key.includes("*")) {
		return extractWildcardBaseKey(key);
	}

	return key;
}

/**
 * Extract the base key name from a wildcard alias.
 *   *ntppi           → ntppi
 *   *ntppi.author    → ntppi
 *   *"NTPPi.author"  → ntppi
 *   type.*ntppi      → ntppi
 *   type.*"NTPPi.author" → ntppi
 */
function extractWildcardBaseKey(key: string): string {
	const starIdx = key.indexOf("*");
	let afterStar = key.slice(starIdx + 1);

	// Strip quotes if present
	if (afterStar.startsWith('"') && afterStar.endsWith('"')) {
		afterStar = afterStar.slice(1, -1);
	}

	// Take the part before any dot (base key name)
	const dotIdx = afterStar.indexOf(".");
	if (dotIdx !== -1) {
		return afterStar.slice(0, dotIdx).toLowerCase();
	}

	return afterStar.toLowerCase();
}
