import {
	GroupDefinition,
	ImpliedRelation,
	RelationAlias,
	RelationDefinition
} from "../types";

export function createDefaultRelations(): RelationDefinition[] {
	const base: Array<{name: string; visualDirection: RelationDefinition["visualDirection"]}> = [
		{name: "up", visualDirection: "ascending"},
		{name: "down", visualDirection: "descending"},
		{name: "next", visualDirection: "sequential"},
		{name: "prev", visualDirection: "sequential"}
	];
	const relations = base.map(({name, visualDirection}) => ({
		name,
		aliases: createDefaultAliases(name),
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
		const relation = relations.find((item) => item.name === from);
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

function createDefaultAliases(name: string): RelationAlias[] {
	return [
		{type: "property", key: name},
		{type: "dotProperty", key: `relations.${name}`},
		{type: "relationsMap", key: name}
	];
}
