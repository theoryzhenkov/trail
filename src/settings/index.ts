import {RelationDefinition, RelationGroup} from "../types";
import {createDefaultRelations, createDefaultGroups} from "./defaults";

export {TrailSettingTab} from "./settings-tab";

export interface TrailSettings {
	relations: RelationDefinition[];
	groups: RelationGroup[];
}

export const DEFAULT_SETTINGS: TrailSettings = {
	relations: createDefaultRelations(),
	groups: createDefaultGroups()
};
