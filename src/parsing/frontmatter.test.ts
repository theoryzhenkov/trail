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

describe("wildcard alias resolution", () => {
	function makeWildcardDefs(
		relationName: string,
		...aliasKeys: string[]
	): RelationDefinition[] {
		return [
			{
				uid: relationName,
				name: relationName,
				aliases: aliasKeys.map((key) => ({ key })),
				impliedRelations: [],
			},
		];
	}

	it("*KEY at depth — scalar value", () => {
		const fm = {
			type: { book: { ntppi: "[[AI Safety]]" } },
		};
		const defs = makeWildcardDefs("ntppi", "*ntppi");
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(1);
		expect(relations[0]).toEqual({
			relation: "ntppi",
			target: "AI Safety",
		});
	});

	it("*KEY at depth — array value", () => {
		const fm = {
			type: { book: { ntppi: ["[[AI Safety]]", "[[Rationality]]"] } },
		};
		const defs = makeWildcardDefs("ntppi", "*ntppi");
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(2);
		expect(relations.map((r) => r.target)).toEqual([
			"AI Safety",
			"Rationality",
		]);
	});

	it("*KEY at depth — object value (children → labels)", () => {
		const fm = {
			type: {
				book: {
					ntppi: {
						author: ["[[Eliezer Yudkowsky]]", "[[Nate Soares]]"],
						series: "[[MIRI Series]]",
					},
				},
			},
		};
		const defs = makeWildcardDefs("ntppi", "*ntppi");
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(3);
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "author",
			target: "Eliezer Yudkowsky",
		});
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "author",
			target: "Nate Soares",
		});
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "series",
			target: "MIRI Series",
		});
	});

	it("*KEY at depth — dot-key NOT matched (notation-specific)", () => {
		// Unquoted wildcard should NOT match literal dot-keys
		const fm = {
			type: { book: { "ntppi.author": "[[Someone]]" } },
		};
		const defs = makeWildcardDefs("ntppi", "*ntppi");
		const { relations } = parseFrontmatterRelations(fm, defs);

		// "ntppi.author" is not "ntppi" — should not match
		expect(relations).toHaveLength(0);
	});

	it('*"KEY.LABEL" at depth — matches literal dot-key, extracts label', () => {
		const fm = {
			type: {
				book: {
					"NTPPi.author": [
						"[[Eliezer Yudkowsky]]",
						"[[Nate Soares]]",
					],
				},
			},
		};
		const defs = makeWildcardDefs("ntppi", '*"NTPPi.author"');
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(2);
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "author",
			target: "Eliezer Yudkowsky",
		});
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "author",
			target: "Nate Soares",
		});
	});

	it('*"KEY.{L1, L2}" — matches multiple literal dot-keys', () => {
		const fm = {
			data: {
				"ntppi.foo": "[[target1]]",
				"ntppi.bar": "[[target2]]",
				"ntppi.baz": "[[target3]]",
			},
		};
		const defs = makeWildcardDefs("ntppi", '*"NTPPi.{foo, bar}"');
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(2);
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "foo",
			target: "target1",
		});
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "bar",
			target: "target2",
		});
	});

	it("*KEY.LABEL — object notation label filter", () => {
		const fm = {
			type: {
				book: {
					ntppi: {
						author: "[[Eliezer]]",
						series: "[[MIRI]]",
					},
				},
			},
		};
		const defs = makeWildcardDefs("ntppi", "*ntppi.author");
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(1);
		expect(relations[0]).toEqual({
			relation: "ntppi",
			label: "author",
			target: "Eliezer",
		});
	});

	it("*KEY.{L1, L2} — object notation set filter", () => {
		const fm = {
			deep: {
				ntppi: {
					author: "[[Eliezer]]",
					series: "[[MIRI]]",
					editor: "[[Someone]]",
				},
			},
		};
		const defs = makeWildcardDefs("ntppi", "*ntppi.{author, series}");
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(2);
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "author",
			target: "Eliezer",
		});
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "series",
			target: "MIRI",
		});
	});

	it("PREFIX.*KEY — prefix restriction", () => {
		const fm = {
			type: { book: { ntppi: "[[AI Safety]]" } },
			other: { ntppi: "[[Should Not Match]]" },
		};
		const defs = makeWildcardDefs("ntppi", "type.*ntppi");
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(1);
		expect(relations[0]).toEqual({
			relation: "ntppi",
			target: "AI Safety",
		});
	});

	it("PREFIX.*KEY.LABEL — prefix + label filter", () => {
		const fm = {
			type: {
				book: {
					ntppi: {
						author: "[[Eliezer]]",
						series: "[[MIRI]]",
					},
				},
			},
		};
		const defs = makeWildcardDefs("ntppi", "type.*ntppi.author");
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(1);
		expect(relations[0]).toEqual({
			relation: "ntppi",
			label: "author",
			target: "Eliezer",
		});
	});

	it('PREFIX.*"KEY.LABEL" — prefix + quoted dot-key', () => {
		const fm = {
			type: {
				book: { "NTPPi.author": "[[Eliezer]]" },
			},
		};
		const defs = makeWildcardDefs("ntppi", 'type.*"NTPPi.author"');
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(1);
		expect(relations[0]).toEqual({
			relation: "ntppi",
			label: "author",
			target: "Eliezer",
		});
	});

	it("array of objects — walk recurses into array elements", () => {
		const fm = {
			relations: [
				{ "NTPPi.foo": "[[target1]]" },
				{ "NTPPi.bar": "[[target2]]" },
				{ other: "[[ignored]]" },
			],
		};
		const defs = makeWildcardDefs("ntppi", '*"NTPPi.{foo, bar}"');
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(2);
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "foo",
			target: "target1",
		});
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "bar",
			target: "target2",
		});
	});

	it("*KEY.LABEL on scalar value — filtered out (no label on scalar)", () => {
		const fm = {
			type: { book: { ntppi: "[[AI Safety]]" } },
		};
		const defs = makeWildcardDefs("ntppi", "*ntppi.author");
		const { relations } = parseFrontmatterRelations(fm, defs);

		// Scalar produces unlabeled match, which is excluded by the label filter
		expect(relations).toHaveLength(0);
	});

	it("no matches → empty result", () => {
		const fm = {
			type: { book: { something: "[[Value]]" } },
		};
		const defs = makeWildcardDefs("ntppi", "*ntppi");
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(0);
	});

	it("dedup with regular aliases", () => {
		// Both wildcard and regular alias resolve to the same relation+target
		const fm = {
			ntppi: "[[AI Safety]]",
			type: { ntppi: "[[AI Safety]]" },
		};
		const defs: RelationDefinition[] = [
			{
				uid: "ntppi",
				name: "ntppi",
				aliases: [{ key: "ntppi" }, { key: "*ntppi" }],
				impliedRelations: [],
			},
		];
		const { relations } = parseFrontmatterRelations(fm, defs);

		// Should be deduped
		expect(relations).toHaveLength(1);
		expect(relations[0]).toEqual({
			relation: "ntppi",
			target: "AI Safety",
		});
	});

	it('mixed: both *KEY and *"KEY.LABEL" aliases on same relation', () => {
		const fm = {
			type: {
				book: {
					NTPPi: "[[AI Safety]]",
					"NTPPi.author": ["[[Eliezer Yudkowsky]]"],
				},
			},
		};
		const defs: RelationDefinition[] = [
			{
				uid: "ntppi",
				name: "ntppi",
				aliases: [
					{ key: "type.*NTPPi" },
					{ key: 'type.*"NTPPi.author"' },
				],
				impliedRelations: [],
			},
		];
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(2);
		expect(relations).toContainEqual({
			relation: "ntppi",
			target: "AI Safety",
		});
		expect(relations).toContainEqual({
			relation: "ntppi",
			label: "author",
			target: "Eliezer Yudkowsky",
		});
	});

	it("case-insensitive key matching in tree walk", () => {
		const fm = {
			type: { Book: { NTPPI: "[[Target]]" } },
		};
		const defs = makeWildcardDefs("ntppi", "type.*ntppi");
		const { relations } = parseFrontmatterRelations(fm, defs);

		expect(relations).toHaveLength(1);
		expect(relations[0]).toEqual({
			relation: "ntppi",
			target: "Target",
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
