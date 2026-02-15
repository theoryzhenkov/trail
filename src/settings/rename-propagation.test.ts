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
		hideEmptyGroups: false,
		editorMode: "auto",
	};
}

describe("rename propagation", () => {
	describe("propagateRelationRename", () => {
		it("rewrites relation tokens in tql queries", () => {
			const settings = createSettings();

			propagateRelationRename(settings, "up", "ancestor");

			expect(settings.tqlGroups[0]?.query).toBe(
				'group "Ancestors"\nfrom ancestor :depth 2 where $traversal.relation = "up"'
			);
		});

		it("is a no-op for empty old name or same old/new name", () => {
			const settings = createSettings();
			const originalQuery = settings.tqlGroups[0]?.query;

			propagateRelationRename(settings, "", "ancestor");
			propagateRelationRename(settings, "up", "up");

			expect(settings.tqlGroups[0]?.query).toBe(originalQuery);
		});
	});

	describe("propagateRelationDelete", () => {
		it("removes implied targets", () => {
			const settings = createSettings();

			propagateRelationDelete(settings, "down", "rel-down");

			expect(settings.relations[0]?.impliedRelations).toEqual([]);
		});

		it("is a no-op when no references exist", () => {
			const settings = createSettings();
			const originalImplied = [...(settings.relations[1]?.impliedRelations ?? [])];

			propagateRelationDelete(settings, "missing", "rel-missing");

			expect(settings.relations[1]?.impliedRelations).toEqual(originalImplied);
		});
	});
});
