/**
 * Tests for frontmatter relation parsing with label support.
 */

import { describe, it, expect } from "vitest";
import { parseFrontmatterRelations, parseFileProperties } from "./frontmatter";
import { RelationDefinition } from "../types";

function makeRelationDefs(...names: string[]): RelationDefinition[] {
	return names.map((name) => ({
		uid: name,
		name,
		aliases: [{ key: name }],
		impliedRelations: [],
	}));
}

describe("parseFrontmatterRelations", () => {
	describe("regular (non-labeled) parsing", () => {
		it("should parse a single wikilink value", () => {
			const fm = { up: "[[Parent]]" };
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(1);
			expect(relations[0]).toEqual({ relation: "up", target: "Parent" });
		});

		it("should parse an array of wikilinks", () => {
			const fm = { up: ["[[A]]", "[[B]]", "[[C]]"] };
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(3);
			expect(relations.map((r) => r.target)).toEqual(["A", "B", "C"]);
			expect(relations.every((r) => r.relation === "up")).toBe(true);
		});

		it("should skip keys that are not relation aliases", () => {
			const fm = { up: "[[Parent]]", tags: "some-tag" };
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(1);
			expect(relations[0]?.relation).toBe("up");
		});

		it("should handle undefined frontmatter", () => {
			const defs = makeRelationDefs("up");
			const { relations, consumedKeys } = parseFrontmatterRelations(
				undefined,
				defs,
			);

			expect(relations).toHaveLength(0);
			expect(consumedKeys.size).toBe(0);
		});

		it("should normalize relation names to lowercase", () => {
			const fm = { UP: "[[Parent]]" };
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(1);
			expect(relations[0]?.relation).toBe("up");
		});

		it("should deduplicate identical relations", () => {
			const fm = { up: ["[[A]]", "[[A]]"] };
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(1);
		});
	});

	describe("object-value detection (nested YAML)", () => {
		it("should produce labeled relations from nested object", () => {
			const fm = {
				up: { author: "[[John Lee]]", series: "[[Fantasy Saga]]" },
			};
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(2);
			expect(relations).toContainEqual({
				relation: "up",
				label: "author",
				target: "John Lee",
			});
			expect(relations).toContainEqual({
				relation: "up",
				label: "series",
				target: "Fantasy Saga",
			});
		});

		it("should add nested object key to consumedKeys", () => {
			const fm = {
				up: { author: "[[John Lee]]" },
			};
			const defs = makeRelationDefs("up");
			const { consumedKeys } = parseFrontmatterRelations(fm, defs);

			expect(consumedKeys.has("up")).toBe(true);
		});

		it("should handle array values inside nested objects", () => {
			const fm = {
				up: { author: ["[[A]]", "[[B]]"] },
			};
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(2);
			expect(relations).toContainEqual({
				relation: "up",
				label: "author",
				target: "A",
			});
			expect(relations).toContainEqual({
				relation: "up",
				label: "author",
				target: "B",
			});
		});
	});

	describe("dot-key scanning", () => {
		it("should produce labeled relation from dot-separated key", () => {
			const fm = { "up.author": "[[John Lee]]" };
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(1);
			expect(relations[0]).toEqual({
				relation: "up",
				label: "author",
				target: "John Lee",
			});
		});

		it("should add dot-key to consumedKeys", () => {
			const fm = { "up.author": "[[John Lee]]" };
			const defs = makeRelationDefs("up");
			const { consumedKeys } = parseFrontmatterRelations(fm, defs);

			expect(consumedKeys.has("up.author")).toBe(true);
		});

		it("should ignore dot-keys whose prefix is not a known relation", () => {
			const fm = { "unknown.author": "[[John Lee]]" };
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(0);
		});
	});

	describe("array values with labels", () => {
		it("should produce multiple labeled relations from dot-key array", () => {
			const fm = { "up.author": ["[[A]]", "[[B]]"] };
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(2);
			expect(relations).toContainEqual({
				relation: "up",
				label: "author",
				target: "A",
			});
			expect(relations).toContainEqual({
				relation: "up",
				label: "author",
				target: "B",
			});
		});
	});

	describe("mixed labeled and unlabeled", () => {
		it("should handle both unlabeled and labeled relations for the same relation", () => {
			const fm = {
				up: "[[Parent]]",
				"up.author": "[[John]]",
			};
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(2);

			const unlabeled = relations.find((r) => r.label === undefined);
			expect(unlabeled).toEqual({ relation: "up", target: "Parent" });

			const labeled = relations.find((r) => r.label !== undefined);
			expect(labeled).toEqual({
				relation: "up",
				label: "author",
				target: "John",
			});
		});
	});

	describe("case normalization", () => {
		it("should lowercase labels from nested object keys", () => {
			const fm = {
				up: { Author: "[[John]]" },
			};
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(1);
			expect(relations[0]?.label).toBe("author");
		});

		it("should lowercase labels from dot-key scanning", () => {
			const fm = { "up.Author": "[[John]]" };
			const defs = makeRelationDefs("up");
			const { relations } = parseFrontmatterRelations(fm, defs);

			expect(relations).toHaveLength(1);
			expect(relations[0]?.label).toBe("author");
		});
	});

	describe("consumed keys", () => {
		it("should include dot-keys in consumedKeys so they are excluded from file properties", () => {
			const fm = {
				"up.author": "[[John]]",
				"up.series": "[[Saga]]",
				title: "My Note",
			};
			const defs = makeRelationDefs("up");
			const { consumedKeys } = parseFrontmatterRelations(fm, defs);

			expect(consumedKeys.has("up.author")).toBe(true);
			expect(consumedKeys.has("up.series")).toBe(true);
			expect(consumedKeys.has("title")).toBe(false);
		});

		it("should include object-value relation keys in consumedKeys", () => {
			const fm = {
				up: { author: "[[John]]" },
				title: "My Note",
			};
			const defs = makeRelationDefs("up");
			const { consumedKeys } = parseFrontmatterRelations(fm, defs);

			expect(consumedKeys.has("up")).toBe(true);
			expect(consumedKeys.has("title")).toBe(false);
		});
	});
});

describe("parseFileProperties", () => {
	it("should exclude consumed keys from file properties", () => {
		const fm = {
			"up.author": "[[John]]",
			title: "My Note",
			tags: ["a", "b"],
		};
		const excludeKeys = new Set(["up.author"]);
		const props = parseFileProperties(fm, excludeKeys);

		expect(props).not.toHaveProperty("up.author");
		expect(props).toHaveProperty("title", "My Note");
		expect(props).toHaveProperty("tags", ["a", "b"]);
	});

	it("should return empty object for undefined frontmatter", () => {
		const props = parseFileProperties(undefined, new Set());
		expect(props).toEqual({});
	});

	it("should exclude the 'relations' key by default", () => {
		const fm = {
			relations: "something",
			title: "My Note",
		};
		const props = parseFileProperties(fm, new Set());

		expect(props).not.toHaveProperty("relations");
		expect(props).toHaveProperty("title", "My Note");
	});
});
