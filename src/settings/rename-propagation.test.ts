import {describe, expect, it} from "vitest";
import type {TrailSettings} from "./index";
import {propagateRelationDelete, propagateRelationRename} from "./rename-propagation";

function createSettings(): TrailSettings {
	return {
		relations: [
			{
				uid: "rel-up",
				name: "up",
				aliases: [{key: "up"}],
				impliedRelations: [{targetRelationUid: "rel-down", direction: "reverse"}],
			},
			{
				uid: "rel-down",
				name: "down",
				aliases: [{key: "down"}],
				impliedRelations: [],
			},
		],
		tqlGroups: [
			{
				query: 'group "Ancestors"\nfrom up :depth 2 where $traversal.relation = "up"',
				enabled: true,
			},
		],
		groups: [
			{
				name: "Legacy",
				members: [{relation: "up", depth: 1}],
			},
		],
		hideEmptyGroups: false,
		editorMode: "auto",
	};
}

describe("rename propagation", () => {
	describe("propagateRelationRename", () => {
		it("rewrites relation tokens in tql queries and updates legacy members", () => {
			const settings = createSettings();

			propagateRelationRename(settings, "up", "ancestor");

			expect(settings.tqlGroups[0]?.query).toBe(
				'group "Ancestors"\nfrom ancestor :depth 2 where $traversal.relation = "up"'
			);
			// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy coverage
			expect(settings.groups[0]?.members[0]?.relation).toBe("ancestor");
		});

		it("is a no-op for empty old name or same old/new name", () => {
			const settings = createSettings();
			const originalQuery = settings.tqlGroups[0]?.query;
			// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy coverage
			const originalLegacy = settings.groups[0]?.members[0]?.relation;

			propagateRelationRename(settings, "", "ancestor");
			propagateRelationRename(settings, "up", "up");

			expect(settings.tqlGroups[0]?.query).toBe(originalQuery);
			// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy coverage
			expect(settings.groups[0]?.members[0]?.relation).toBe(originalLegacy);
		});
	});

	describe("propagateRelationDelete", () => {
		it("removes implied targets and legacy group members", () => {
			const settings = createSettings();

			propagateRelationDelete(settings, "down", "rel-down");

			expect(settings.relations[0]?.impliedRelations).toEqual([]);
			// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy coverage
			expect(settings.groups[0]?.members).toEqual([{relation: "up", depth: 1}]);
		});

		it("is a no-op when no references exist", () => {
			const settings = createSettings();
			const originalImplied = [...(settings.relations[1]?.impliedRelations ?? [])];
			// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy coverage
			const originalMembers = [...(settings.groups[0]?.members ?? [])];

			propagateRelationDelete(settings, "missing", "rel-missing");

			expect(settings.relations[1]?.impliedRelations).toEqual(originalImplied);
			// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy coverage
			expect(settings.groups[0]?.members).toEqual(originalMembers);
		});
	});
});
