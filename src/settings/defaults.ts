import {
	GroupDefinition,
	ImpliedRelation,
	RelationAlias,
	RelationDefinition
} from "../types";

export function createDefaultRelations(): RelationDefinition[] {
	const base: Array<{id: string; visualDirection: RelationDefinition["visualDirection"]}> = [
		{id: "up", visualDirection: "ascending"},
		{id: "down", visualDirection: "descending"},
		{id: "next", visualDirection: "descending"},
		{id: "prev", visualDirection: "descending"}
	];
	const relations = base.map(({id, visualDirection}) => ({
		id,
		aliases: createDefaultAliases(id),
		impliedRelations: [] as ImpliedRelation[],
		visualDirection
	}));

	const impliedPairs: Array<[string, string]> = [
		["up", "down"],
		["down", "up"],
		["next", "prev"],
		["prev", "next"]
	];

	for (const [from, to] of impliedPairs) {
		const relation = relations.find((item) => item.id === from);
		if (!relation) {
			continue;
		}
		relation.impliedRelations.push({
			targetRelation: to,
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
	return [
		{key: name},
		{key: `relations.${name}`},
	];
}
