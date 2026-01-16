import {
	ImpliedRelation,
	RelationAlias,
	RelationDefinition,
	RelationGroup,
	RelationGroupMember
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

export function createDefaultGroups(): RelationGroup[] {
	return [
		createDefaultGroup("Hierarchy", [
			{relation: "up", depth: 0},
			{relation: "next", depth: 1}
		]),
		createDefaultGroup("Reverse", [
			{relation: "down", depth: 0},
			{relation: "prev", depth: 1}
		])
	];
}

function createDefaultGroup(name: string, members: RelationGroupMember[]): RelationGroup {
	return {
		name,
		members
	};
}

function createDefaultAliases(name: string): RelationAlias[] {
	return [
		{type: "property", key: name},
		{type: "dotProperty", key: `relations.${name}`},
		{type: "relationsMap", key: name}
	];
}
