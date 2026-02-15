import {rewriteRelationInTqlQuery} from "../query/rewrite-relation";
import type {TrailSettings} from "./index";

export function propagateRelationRename(
	settings: TrailSettings,
	oldName: string,
	newName: string
): void {
	if (!oldName || oldName === newName) {
		return;
	}

	for (const group of settings.tqlGroups) {
		group.query = rewriteRelationInTqlQuery(group.query, oldName, newName);
	}

	// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy migration support
	for (const group of settings.groups) {
		for (const member of group.members) {
			if (member.relation === oldName) {
				member.relation = newName;
			}
		}
	}
}

export function propagateRelationDelete(
	settings: TrailSettings,
	relationName: string,
	relationUid: string
): void {
	for (const relation of settings.relations) {
		relation.impliedRelations = relation.impliedRelations.filter(
			(implied) => implied.targetRelationUid !== relationUid
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy migration support
	for (const group of settings.groups) {
		group.members = group.members.filter((member) => member.relation !== relationName);
	}
}
