import {GroupDefinition, RelationDefinition} from "../types";
import {createDefaultRelations, createDefaultTqlGroups} from "./defaults";
import {savedDataNeedsMigration as checkNeedsMigration, applyMigrations} from "./migrations";
import {
	findRelationByName,
	findRelationByUid,
	getRelationDisplayName,
} from "../relations";

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
	hideEmptyGroups: boolean;
	/** Default editor mode for TQL groups */
	editorMode: EditorMode;
}

export const DEFAULT_SETTINGS: TrailSettings = {
	relations: createDefaultRelations(),
	tqlGroups: createDefaultTqlGroups(),
	hideEmptyGroups: false,
	editorMode: "auto",
};

/**
 * Build settings from saved data, handling migration.
 */
export function buildSettings(savedData: Partial<TrailSettings> | null): TrailSettings {
	const data = savedData ?? {};

	// Start with saved or default values
	let tqlGroups = data.tqlGroups ?? [];
	let relations = data.relations ?? createDefaultRelations();

	// If no saved groups, apply defaults (fresh installs)
	if (tqlGroups.length === 0) {
		tqlGroups = createDefaultTqlGroups();
	}

	// Apply migrations for current schema
	const migrated = applyMigrations({tqlGroups, relations});
	tqlGroups = migrated.tqlGroups;
	relations = migrated.relations;

	return {
		relations,
		tqlGroups,
		hideEmptyGroups: data.hideEmptyGroups ?? false,
		editorMode: data.editorMode ?? "auto",
	};
}

/**
 * Check if saved data has old TQL syntax that needs migration.
 * Used to determine if settings should be saved after loading.
 */
export function savedDataNeedsMigration(savedData: Partial<TrailSettings> | null): boolean {
	return checkNeedsMigration(savedData);
}

export {getRelationDisplayName, findRelationByUid, findRelationByName};
