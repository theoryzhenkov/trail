import {GroupDefinition, RelationDefinition, RelationGroup} from "../types";
import {createDefaultRelations, createDefaultGroups, createDefaultTqlGroups} from "./defaults";

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
