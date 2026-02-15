import {describe, expect, it} from "vitest";
import {applyMigrations, savedDataNeedsMigration} from "./migrations";

describe("settings relation identity migration", () => {
	it("detects legacy relation schema", () => {
		const savedData = {
			relations: [
				{
					id: "up",
					displayName: "UP",
					aliases: [{key: "up"}],
					impliedRelations: [{targetRelation: "down", direction: "reverse"}],
				},
			],
		};

		expect(savedDataNeedsMigration(savedData)).toBe(true);
	});

	it("migrates id/displayName to uid/name and remaps implied targets", () => {
		const savedData = {
			relations: [
				{
					id: "up",
					displayName: "UP",
					aliases: [{key: "up"}],
					impliedRelations: [{targetRelation: "down", direction: "reverse"}],
				},
				{
					id: "down",
					aliases: [{key: "down"}],
					impliedRelations: [],
				},
			],
		};

		const migrated = applyMigrations(savedData);
		const up = migrated.relations.find((relation) => relation.name === "UP");
		const down = migrated.relations.find((relation) => relation.name === "down");

		expect(up).toBeDefined();
		expect(down).toBeDefined();
		expect(up?.uid.length).toBeGreaterThan(0);
		expect(down?.uid.length).toBeGreaterThan(0);
		expect(up?.impliedRelations[0]?.targetRelationUid).toBe(down?.uid);
	});
});
