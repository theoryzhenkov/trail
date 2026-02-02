import {GroupDefinition, RelationAlias, RelationDefinition, RelationGroup} from "../types";
import {createDefaultRelations, createDefaultTqlGroups} from "./defaults";
import {migrateAllGroups} from "../query/migration";
import {migrateAllTqlSyntax, needsSyntaxMigration} from "../query/syntax-migration";

export {TrailSettingTab} from "./settings-tab";

/** @deprecated Legacy alias format with type field */
interface LegacyRelationAlias {
	type: "property" | "dotProperty" | "relationsMap";
	key: string;
}

/**
 * Editor mode for TQL groups
 * - visual: Always show visual editor (falls back to query for complex queries)
 * - query: Always show query editor
 * - auto: Show visual editor if query is simple enough
 */
export type EditorMode = "visual" | "query" | "auto";

export interface TrailSettings {
	relations: RelationDefinition[];
	/** TQL-based groups (authoritative format) */
	tqlGroups: GroupDefinition[];
	/** @deprecated Legacy groups - kept only for migration. Will be auto-migrated on load. */
	groups: RelationGroup[];
	hideEmptyGroups: boolean;
	/** Default editor mode for TQL groups */
	editorMode: EditorMode;
}

export const DEFAULT_SETTINGS: TrailSettings = {
	relations: createDefaultRelations(),
	tqlGroups: createDefaultTqlGroups(),
	groups: [], // Empty - legacy groups are only loaded from saved data for migration
	hideEmptyGroups: false,
	editorMode: "auto",
};

/**
 * Build settings from saved data, handling migration.
 * Legacy groups are automatically migrated to TQL on load.
 */
export function buildSettings(savedData: Partial<TrailSettings> | null): TrailSettings {
	const data = savedData ?? {};
	
	// Start with saved or default values
	let tqlGroups = data.tqlGroups ?? [];
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration
	let legacyGroups = data.groups ?? [];
	let relations = data.relations ?? createDefaultRelations();
	
	// If no TQL groups but has legacy groups, apply defaults first
	// (This handles fresh installs)
	if (tqlGroups.length === 0 && legacyGroups.length === 0) {
		tqlGroups = createDefaultTqlGroups();
	}
	
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

	return {
		relations,
		tqlGroups,
		groups: legacyGroups,
		hideEmptyGroups: data.hideEmptyGroups ?? false,
		editorMode: data.editorMode ?? "auto",
	};
}

/**
 * Check if settings have legacy groups (for UI display purposes)
 * Note: Legacy groups are auto-migrated on load, so this should typically be false
 */
export function hasLegacyGroups(settings: TrailSettings): boolean {
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration check
	return settings.groups.length > 0;
}

/**
 * Check if saved data has legacy groups or old TQL syntax that need migration
 * Used to determine if settings should be saved after loading
 */
export function savedDataNeedsMigration(savedData: Partial<TrailSettings> | null): boolean {
	if (!savedData) return false;

	// Check for legacy groups
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for migration check
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

/** @deprecated Legacy relation format with name instead of id */
interface LegacyRelationDefinition {
	name?: string;
	id?: string;
	displayName?: string;
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

/**
 * Get the display name for a relation.
 * Returns displayName if set, otherwise falls back to id.
 */
export function getRelationDisplayName(relation: RelationDefinition): string {
	return relation.displayName ?? relation.id;
}

/**
 * Find a relation by id (case-insensitive lookup).
 */
export function findRelationById(relations: RelationDefinition[], id: string): RelationDefinition | undefined {
	const normalizedId = id.toLowerCase();
	return relations.find((r) => r.id === normalizedId);
}
