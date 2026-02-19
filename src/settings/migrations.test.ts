import { describe, expect, it } from "vitest";
import { applyMigrations, savedDataNeedsMigration } from "./migrations";

type MigrationInput = NonNullable<
	Parameters<typeof savedDataNeedsMigration>[0]
>;

describe("settings relation identity migration", () => {
	it("detects legacy relation schema", () => {
		const savedData = {
			relations: [
				{
					id: "up",
					displayName: "UP",
					aliases: [{ key: "up" }],
					impliedRelations: [
						{ targetRelation: "down", direction: "reverse" },
					],
				},
			],
		} as unknown as MigrationInput;

		expect(savedDataNeedsMigration(savedData)).toBe(true);
	});

	it("migrates id/displayName to uid/name and remaps implied targets", () => {
		const savedData = {
			relations: [
				{
					id: "up",
					displayName: "UP",
					aliases: [{ key: "up" }],
					impliedRelations: [
						{ targetRelation: "down", direction: "reverse" },
					],
				},
				{
					id: "down",
					aliases: [{ key: "down" }],
					impliedRelations: [],
				},
			],
		} as unknown as MigrationInput;

		const migrated = applyMigrations(savedData);
		const up = migrated.relations.find(
			(relation) => relation.name === "UP",
		);
		const down = migrated.relations.find(
			(relation) => relation.name === "down",
		);

		expect(up).toBeDefined();
		expect(down).toBeDefined();
		expect(up?.uid.length).toBeGreaterThan(0);
		expect(down?.uid.length).toBeGreaterThan(0);
		expect(up?.impliedRelations[0]?.targetRelationUid).toBe(down?.uid);
	});
});

describe("key simplification migration", () => {
	it("detects wildcard aliases as needing migration", () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "ntppi",
					aliases: [{ key: "*ntppi" }, { key: "ntppi" }],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		expect(savedDataNeedsMigration(savedData)).toBe(true);
	});

	it("detects quoted aliases as needing migration", () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "ntppi",
					aliases: [{ key: '"ntppi.author"' }],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		expect(savedDataNeedsMigration(savedData)).toBe(true);
	});

	it("detects relations.X prefix as needing migration", () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "up",
					aliases: [{ key: "up" }, { key: "relations.up" }],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		expect(savedDataNeedsMigration(savedData)).toBe(true);
	});

	it("does not detect plain keys as needing migration", () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "up",
					aliases: [{ key: "up" }],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		expect(savedDataNeedsMigration(savedData)).toBe(false);
	});

	it("simplifies wildcard *KEY to plain key", () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "ntppi",
					aliases: [{ key: "*ntppi" }, { key: "ntppi" }],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		const migrated = applyMigrations(savedData);
		expect(migrated.relations[0]?.aliases).toEqual([{ key: "ntppi" }]);
	});

	it("simplifies *KEY.LABEL to plain key (drops label filter)", () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "ntppi",
					aliases: [{ key: "*ntppi.author" }],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		const migrated = applyMigrations(savedData);
		expect(migrated.relations[0]?.aliases).toEqual([{ key: "ntppi" }]);
	});

	it('simplifies *"KEY.LABEL" to plain key', () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "ntppi",
					aliases: [{ key: '*"NTPPi.author"' }],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		const migrated = applyMigrations(savedData);
		expect(migrated.relations[0]?.aliases).toEqual([{ key: "ntppi" }]);
	});

	it("simplifies PREFIX.*KEY to plain key (drops prefix)", () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "ntppi",
					aliases: [{ key: "type.*ntppi" }],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		const migrated = applyMigrations(savedData);
		expect(migrated.relations[0]?.aliases).toEqual([{ key: "ntppi" }]);
	});

	it("drops relations.X prefix (redundant)", () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "up",
					aliases: [{ key: "up" }, { key: "relations.up" }],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		const migrated = applyMigrations(savedData);
		expect(migrated.relations[0]?.aliases).toEqual([{ key: "up" }]);
	});

	it("strips quotes from quoted aliases", () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "ntppi",
					aliases: [{ key: '"ntppi.author"' }],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		const migrated = applyMigrations(savedData);
		expect(migrated.relations[0]?.aliases).toEqual([
			{ key: "ntppi.author" },
		]);
	});

	it("deduplicates after simplification", () => {
		const savedData = {
			relations: [
				{
					uid: "rel1",
					name: "ntppi",
					aliases: [
						{ key: "ntppi" },
						{ key: "*ntppi" },
						{ key: "type.*ntppi" },
						{ key: '*"NTPPi.author"' },
					],
					impliedRelations: [],
				},
			],
		} as MigrationInput;

		const migrated = applyMigrations(savedData);
		expect(migrated.relations[0]?.aliases).toEqual([{ key: "ntppi" }]);
	});
});
