import {
	ImpliedRelation,
	RelationAlias,
	RelationDefinition,
	RelationGroup,
	RelationGroupMember
} from "../types";

export function createDefaultRelations(): RelationDefinition[] {
	const base = ["up", "down", "next", "prev"];
	const relations = base.map((name) => ({
		name,
		aliases: createDefaultAliases(name),
		impliedRelations: [] as ImpliedRelation[]
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
