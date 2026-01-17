import {GroupDefinition, RelationDefinition, RelationGroup} from "../types";
import {createDefaultRelations, createDefaultGroups, createDefaultTqlGroups} from "./defaults";

export {TrailSettingTab} from "./settings-tab";

export interface TrailSettings {
	relations: RelationDefinition[];
	/** TQL-based groups (new format) */
	tqlGroups: GroupDefinition[];
	/** Legacy groups (old format, kept for migration) */
	groups: RelationGroup[];
	hideEmptyGroups: boolean;
}

export const DEFAULT_SETTINGS: TrailSettings = {
	relations: createDefaultRelations(),
	tqlGroups: createDefaultTqlGroups(),
	groups: createDefaultGroups(),
	hideEmptyGroups: false,
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
