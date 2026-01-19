import {GroupDefinition, RelationDefinition, RelationGroup} from "../types";
import {createDefaultRelations, createDefaultGroups, createDefaultTqlGroups} from "./defaults";
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
	/** TQL-based groups (new format) */
	tqlGroups: GroupDefinition[];
	/** Legacy groups (old format, kept for migration) */
	groups: RelationGroup[];
	hideEmptyGroups: boolean;
	/** Default editor mode for TQL groups */
	editorMode: EditorMode;
}

export const DEFAULT_SETTINGS: TrailSettings = {
	relations: createDefaultRelations(),
	tqlGroups: createDefaultTqlGroups(),
	groups: createDefaultGroups(),
	hideEmptyGroups: false,
	editorMode: "auto",
};

/**
 * Build settings from saved data, handling migration edge cases.
 * If saved data has legacy groups but no tqlGroups field, don't apply default TQL groups
 * to allow proper migration.
 */
export function buildSettings(savedData: Partial<TrailSettings> | null): TrailSettings {
	const data = savedData ?? {};
	
	// Check if this is a migration scenario: has legacy groups but no tqlGroups field
	const hasLegacyInSavedData = Array.isArray(data.groups) && data.groups.length > 0;
	const hasTqlInSavedData = "tqlGroups" in data;
	
	// If legacy groups exist but tqlGroups field is missing, don't apply default TQL groups
	const tqlGroups = hasTqlInSavedData 
		? (data.tqlGroups ?? [])
		: (hasLegacyInSavedData ? [] : createDefaultTqlGroups());
	
	return {
		relations: data.relations ?? createDefaultRelations(),
		tqlGroups,
		groups: data.groups ?? createDefaultGroups(),
		hideEmptyGroups: data.hideEmptyGroups ?? false,
		editorMode: data.editorMode ?? "auto",
	};
}

/**
 * Check if settings have legacy groups that need migration
 */
export function hasLegacyGroups(settings: TrailSettings): boolean {
	return settings.groups.length > 0;
}

/**
 * Check if settings have TQL groups
 */
export function hasTqlGroups(settings: TrailSettings): boolean {
	return settings.tqlGroups.length > 0;
}

/**
 * Migrate legacy groups to TQL format if needed
 * Returns true if migration was performed
 */
export function migrateSettingsIfNeeded(settings: TrailSettings): boolean {
	// Only migrate if there are legacy groups and no TQL groups yet
	if (!hasLegacyGroups(settings) || hasTqlGroups(settings)) {
		return false;
	}

	const migrated = migrateAllGroups(settings.groups);
	settings.tqlGroups = migrated;
	// Clear legacy groups after migration
	settings.groups = [];
	return true;
}
