import {
	GroupDefinition,
	ImpliedRelation,
	RelationAlias,
	RelationDefinition
} from "../types";
import {createRelationUid, formatRelationNameForTql} from "../relations";

export function createDefaultRelations(): RelationDefinition[] {
	const base: Array<{name: string; visualDirection: RelationDefinition["visualDirection"]}> = [
		{name: "up", visualDirection: "ascending"},
		{name: "down", visualDirection: "descending"},
		{name: "next", visualDirection: "descending"},
		{name: "prev", visualDirection: "descending"}
	];
	const relations = base.map(({name, visualDirection}) => ({
		uid: createRelationUid(),
		name,
		aliases: createDefaultAliases(name),
		impliedRelations: [] as ImpliedRelation[],
		visualDirection
	}));
	const uidByName = new Map(relations.map((relation) => [relation.name, relation.uid]));

	const impliedPairs: Array<[string, string]> = [
		["up", "down"],
		["down", "up"],
		["next", "prev"],
		["prev", "next"]
	];

	for (const [from, to] of impliedPairs) {
		const relation = relations.find((item) => item.name === from);
		const targetRelationUid = uidByName.get(to);
		if (!relation || !targetRelationUid) {
			continue;
		}
		relation.impliedRelations.push({
			targetRelationUid,
			direction: "reverse"
		});
	}

	return relations;
}

export function createDefaultTqlGroups(): GroupDefinition[] {
	return [
		{
			query: `group "Ancestors"
from up`,
			enabled: true,
		},
		{
			query: `group "Children"
from down`,
			enabled: true,
		},
		{
			query: `group "Siblings"
from next depth 1, prev depth 1`,
			enabled: true,
		},
	];
}

export function createDefaultAliases(name: string): RelationAlias[] {
	const normalized = formatRelationNameForTql(name);
	return [
		{key: normalized},
		{key: `relations.${normalized}`},
	];
}
