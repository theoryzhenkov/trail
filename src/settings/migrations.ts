/**
 * Settings Migration Module
 * 
 * Handles all settings format migrations in one place.
 * Migrations run once during buildSettings() and are persisted.
 */

import type {RelationDefinition, RelationAlias, GroupDefinition, RelationGroup} from "../types";
import {migrateAllGroups} from "../query/migration";
import {migrateAllTqlSyntax, needsSyntaxMigration} from "../query/syntax-migration";

/** @deprecated Legacy alias format with type field */
interface LegacyRelationAlias {
	type: "property" | "dotProperty" | "relationsMap";
	key: string;
}

/** @deprecated Legacy relation format with name instead of id */
interface LegacyRelationDefinition {
	name?: string;
	id?: string;
	displayName?: string;
}

/**
 * Type for saved settings data (may be in old format)
 */
interface SavedSettingsData {
	tqlGroups?: GroupDefinition[];
	groups?: RelationGroup[];
	relations?: RelationDefinition[];
	hideEmptyGroups?: boolean;
	editorMode?: "visual" | "query" | "auto";
}

/**
 * Check if saved data has any migrations to apply
 */
export function savedDataNeedsMigration(savedData: Partial<SavedSettingsData> | null): boolean {
	if (!savedData) return false;

	// Check for legacy groups
	if (Array.isArray(savedData.groups) && savedData.groups.length > 0) {
		return true;
	}

	// Check for TQL syntax needing migration (3.x → 4.x)
	if (Array.isArray(savedData.tqlGroups)) {
		for (const group of savedData.tqlGroups) {
			if (group.query && needsSyntaxMigration(group.query)) {
				return true;
			}
		}
	}

	// Check for legacy alias format or legacy name field
	if (Array.isArray(savedData.relations)) {
		for (const relation of savedData.relations) {
			if (needsAliasMigration(relation.aliases)) {
				return true;
			}
			if (needsIdMigration(relation)) {
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
	legacyGroups: RelationGroup[];
	relations: RelationDefinition[];
} {
	let tqlGroups = data.tqlGroups ?? [];
	let legacyGroups = data.groups ?? [];
	let relations = data.relations ?? [];

	// Auto-migrate legacy groups to TQL
	if (legacyGroups.length > 0) {
		const migrated = migrateAllGroups(legacyGroups);
		tqlGroups = [...tqlGroups, ...migrated];
		legacyGroups = []; // Clear after migration
	}

	// Auto-migrate TQL syntax from 3.x to 4.x
	migrateAllTqlSyntax(tqlGroups);

	// Auto-migrate legacy alias format
	migrateRelationAliases(relations);

	// Auto-migrate relation name → id format
	migrateRelationIds(relations);

	return {tqlGroups, legacyGroups, relations};
}

/**
 * Check if aliases array contains legacy format (with type field)
 */
function needsAliasMigration(aliases: unknown): boolean {
	if (!Array.isArray(aliases)) return false;
	return aliases.some((alias) => 
		alias && typeof alias === "object" && "type" in alias
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
		const legacyAliases = relation.aliases as unknown as LegacyRelationAlias[];
		
		for (const alias of legacyAliases) {
			migratedAliases.push({key: migrateSingleAlias(alias)});
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

/**
 * Check if relation needs migration from name to id
 */
function needsIdMigration(relation: unknown): boolean {
	if (!relation || typeof relation !== "object") return false;
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration check
	const r = relation as LegacyRelationDefinition;
	// Needs migration if has name but no id
	return "name" in r && !("id" in r);
}

/**
 * Migrate relations from legacy name field to id/displayName format.
 * Old format: {name: string, ...}
 * New format: {id: string (lowercase), displayName?: string, ...}
 */
function migrateRelationIds(relations: RelationDefinition[]): void {
	for (const relation of relations) {
		// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration
		const legacy = relation as unknown as LegacyRelationDefinition;
		if (legacy.name !== undefined && legacy.id === undefined) {
			// Migrate: id is lowercase, displayName preserves original if different
			const normalizedId = legacy.name.toLowerCase();
			relation.id = normalizedId;
			// Only set displayName if it differs from id (preserves custom casing)
			if (legacy.name !== normalizedId) {
				relation.displayName = legacy.name;
			}
			// Clean up old field
			// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration
			delete (relation as unknown as LegacyRelationDefinition).name;
		}
	}
}
