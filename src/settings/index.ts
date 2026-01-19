import {GroupDefinition, RelationDefinition, RelationGroup} from "../types";
import {createDefaultRelations, createDefaultTqlGroups} from "./defaults";
import {migrateAllGroups} from "../query/migration";

export {TrailSettingTab} from "./settings-tab";

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
	let legacyGroups = data.groups ?? [];
	
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
	
	return {
		relations: data.relations ?? createDefaultRelations(),
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
	return settings.groups.length > 0;
}

/**
 * Check if saved data has legacy groups that need migration
 * Used to determine if settings should be saved after loading
 */
export function savedDataNeedsMigration(savedData: Partial<TrailSettings> | null): boolean {
	if (!savedData) return false;
	return Array.isArray(savedData.groups) && savedData.groups.length > 0;
}
