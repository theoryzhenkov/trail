/**
 * Tree Transforms Tests
 * Tests for merging, grouping, and inversion of tree structures
 */

import { describe, it, expect } from "vitest";
import {
	tqlTreeToGroups,
	tqlSubtreesEqual,
	invertDisplayGroups,
} from "./tree-transforms";
import type { QueryResultNode } from "../query/nodes/types";
import type { DisplayGroup } from "../types";

/**
 * Helper to create a QueryResultNode for testing
 */
function tqlNode(
	path: string,
	relation: string,
	children: QueryResultNode[] = [],
	options: Partial<QueryResultNode> = {},
): QueryResultNode {
	return {
		path,
		relation,
		label: options.label,
		depth: options.depth ?? 1,
		implied: options.implied ?? false,
		impliedFrom: options.impliedFrom,
		parent: options.parent ?? null,
		traversalPath: options.traversalPath ?? [path],
		properties: options.properties ?? {},
		displayProperties: options.displayProperties ?? [],
		visualDirection: options.visualDirection ?? "descending",
		hasFilteredAncestor: options.hasFilteredAncestor ?? false,
		children,
	};
}

/**
 * Helper to extract paths from a DisplayGroup tree
 */
function collectGroupPaths(groups: DisplayGroup[]): string[] {
	const paths: string[] = [];
	for (const group of groups) {
		for (const member of group.members) {
			paths.push(member.path);
		}
		paths.push(...collectGroupPaths(group.subgroups));
	}
	return paths;
}

describe("tqlTreeToGroups", () => {
	describe("basic grouping", () => {
		it("should return empty array for empty input", () => {
			const result = tqlTreeToGroups([]);
			expect(result).toEqual([]);
		});

		it("should create single group for single node", () => {
			const nodes = [tqlNode("A.md", "parent")];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(1);
			expect(result[0]?.members[0]?.path).toBe("A.md");
			expect(result[0]?.relations).toEqual(["parent"]);
		});

		it("should group nodes with same relation and no children", () => {
			const nodes = [
				tqlNode("Dad.md", "parent"),
				tqlNode("Mom.md", "parent"),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(2);
			expect(result[0]?.members.map((m) => m.path)).toContain("Dad.md");
			expect(result[0]?.members.map((m) => m.path)).toContain("Mom.md");
		});

		it("should NOT group nodes with different relations", () => {
			const nodes = [
				tqlNode("A.md", "parent"),
				tqlNode("B.md", "sibling"),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(2);
			expect(result[0]?.members[0]?.path).toBe("A.md");
			expect(result[1]?.members[0]?.path).toBe("B.md");
		});
	});

	describe("grouping with identical subtrees", () => {
		it("should group nodes with same relation AND identical children", () => {
			const grandma = tqlNode("Grandma.md", "parent");
			const nodes = [
				tqlNode("Dad.md", "parent", [grandma]),
				tqlNode("Mom.md", "parent", [{ ...grandma }]),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(2);
			expect(result[0]?.subgroups).toHaveLength(1);
			expect(result[0]?.subgroups[0]?.members[0]?.path).toBe(
				"Grandma.md",
			);
		});

		it("should NOT group nodes with same relation but different children", () => {
			const nodes = [
				tqlNode("Dad.md", "parent", [tqlNode("Grandpa.md", "parent")]),
				tqlNode("Mom.md", "parent", [tqlNode("Grandma.md", "parent")]),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(2);
			expect(result[0]?.members[0]?.path).toBe("Dad.md");
			expect(result[1]?.members[0]?.path).toBe("Mom.md");
		});

		it("should handle mixed grouping - some identical, some different", () => {
			const sharedChild = tqlNode("Shared.md", "parent");
			const nodes = [
				tqlNode("A.md", "parent", [sharedChild]),
				tqlNode("B.md", "parent", [{ ...sharedChild }]),
				tqlNode("C.md", "parent", [tqlNode("Different.md", "parent")]),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(2);
			expect(result[0]?.members).toHaveLength(2);
			expect(result[0]?.members.map((m) => m.path)).toContain("A.md");
			expect(result[0]?.members.map((m) => m.path)).toContain("B.md");
			expect(result[1]?.members).toHaveLength(1);
			expect(result[1]?.members[0]?.path).toBe("C.md");
		});

		it("should allow non-adjacent nodes to group", () => {
			const shared = tqlNode("Shared.md", "parent");
			const nodes = [
				tqlNode("A.md", "parent", [shared]),
				tqlNode("B.md", "parent", [tqlNode("Different.md", "parent")]),
				tqlNode("C.md", "parent", [{ ...shared }]),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(2);
			expect(result[0]?.members).toHaveLength(2);
			expect(result[0]?.members.map((m) => m.path)).toContain("A.md");
			expect(result[0]?.members.map((m) => m.path)).toContain("C.md");
			expect(result[1]?.members[0]?.path).toBe("B.md");
		});
	});

	describe("multi-relation merging", () => {
		it("should merge same path reached via different relations", () => {
			const nodes = [tqlNode("B.md", "next"), tqlNode("B.md", "down")];
			const result = tqlTreeToGroups(nodes);

			// B should appear once with both relations
			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(1);
			expect(result[0]?.members[0]?.path).toBe("B.md");
			expect(result[0]?.members[0]?.relations).toEqual(["down", "next"]);
			expect(result[0]?.relations).toEqual(["down", "next"]);
		});

		it("should merge children from different relation traversals", () => {
			// B via next has child C; B via down has no children
			const nodes = [
				tqlNode("B.md", "next", [tqlNode("C.md", "next")]),
				tqlNode("B.md", "down"),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members[0]?.path).toBe("B.md");
			expect(result[0]?.members[0]?.relations).toEqual(["down", "next"]);
			// Children should include C from the next traversal
			expect(result[0]?.subgroups).toHaveLength(1);
			expect(result[0]?.subgroups[0]?.members[0]?.path).toBe("C.md");
		});

		it("should recursively merge children that share the same path", () => {
			// B via next has child C(next); B via down has child C(down)
			const nodes = [
				tqlNode("B.md", "next", [tqlNode("C.md", "next")]),
				tqlNode("B.md", "down", [tqlNode("C.md", "down")]),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members[0]?.path).toBe("B.md");
			expect(result[0]?.members[0]?.relations).toEqual(["down", "next"]);
			// C should be merged with both relations
			expect(result[0]?.subgroups).toHaveLength(1);
			expect(result[0]?.subgroups[0]?.members[0]?.relations).toEqual([
				"down",
				"next",
			]);
		});

		it("should group merged nodes only if relation sets match", () => {
			// B reached by both next and down; D reached only by down
			const nodes = [
				tqlNode("B.md", "next"),
				tqlNode("B.md", "down"),
				tqlNode("D.md", "down"),
			];
			const result = tqlTreeToGroups(nodes);

			// B has relations [down, next], D has relations [down] — different sets, separate groups
			expect(result).toHaveLength(2);
			expect(result[0]?.members[0]?.path).toBe("B.md");
			expect(result[0]?.members[0]?.relations).toEqual(["down", "next"]);
			expect(result[1]?.members[0]?.path).toBe("D.md");
			expect(result[1]?.members[0]?.relations).toEqual(["down"]);
		});

		it("should group merged nodes when relation sets AND subtrees match", () => {
			// B and D both reached by next and down, both with no children
			const nodes = [
				tqlNode("B.md", "next"),
				tqlNode("B.md", "down"),
				tqlNode("D.md", "next"),
				tqlNode("D.md", "down"),
			];
			const result = tqlTreeToGroups(nodes);

			// B and D have same relation set and same subtrees — grouped together
			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(2);
			expect(result[0]?.members.map((m) => m.path)).toContain("B.md");
			expect(result[0]?.members.map((m) => m.path)).toContain("D.md");
			expect(result[0]?.relations).toEqual(["down", "next"]);
		});

		it("should take implied=false when any instance is explicit", () => {
			const nodes = [
				tqlNode("B.md", "next", [], {
					implied: true,
					impliedFrom: "prev",
				}),
				tqlNode("B.md", "down", [], { implied: false }),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result[0]?.members[0]?.implied).toBe(false);
			expect(result[0]?.members[0]?.impliedFrom).toBeUndefined();
		});

		it("should preserve implied=true when all instances are implied", () => {
			const nodes = [
				tqlNode("B.md", "next", [], {
					implied: true,
					impliedFrom: "prev",
				}),
				tqlNode("B.md", "down", [], {
					implied: true,
					impliedFrom: "up",
				}),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result[0]?.members[0]?.implied).toBe(true);
		});

		it("should preserve order of first appearance when merging", () => {
			const nodes = [
				tqlNode("A.md", "next"),
				tqlNode("B.md", "down"),
				tqlNode("A.md", "down"),
			];
			const result = tqlTreeToGroups(nodes);

			// A appeared first, B appeared second
			// A has [down, next], B has [down] — different sets, separate groups
			expect(result).toHaveLength(2);
			expect(result[0]?.members[0]?.path).toBe("A.md");
			expect(result[1]?.members[0]?.path).toBe("B.md");
		});
	});

	describe("deep nesting", () => {
		it("should handle multiple levels of nesting", () => {
			const nodes = [
				tqlNode("Parent.md", "up", [
					tqlNode("Grandparent.md", "up", [
						tqlNode("GreatGrandparent.md", "up"),
					]),
				]),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members[0]?.path).toBe("Parent.md");
			expect(result[0]?.subgroups).toHaveLength(1);
			expect(result[0]?.subgroups[0]?.members[0]?.path).toBe(
				"Grandparent.md",
			);
			expect(
				result[0]?.subgroups[0]?.subgroups[0]?.members[0]?.path,
			).toBe("GreatGrandparent.md");
		});

		it("should preserve implied status through grouping", () => {
			const nodes = [
				tqlNode("A.md", "parent", [], {
					implied: true,
					impliedFrom: "child",
				}),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result[0]?.members[0]?.implied).toBe(true);
			expect(result[0]?.members[0]?.impliedFrom).toBe("child");
		});
	});

	describe("family tree scenario", () => {
		it("should correctly group shared grandparents", () => {
			const grandparents = [
				tqlNode("Grandmother.md", "parent"),
				tqlNode("Grandfather.md", "parent"),
			];
			const nodes = [
				tqlNode("Dad.md", "parent", grandparents),
				tqlNode("Mom.md", "parent", [
					...grandparents.map((g) => ({ ...g })),
				]),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(2);
			expect(result[0]?.subgroups).toHaveLength(1);
			expect(result[0]?.subgroups[0]?.members).toHaveLength(2);
		});

		it("should split when parents have different grandparents", () => {
			const nodes = [
				tqlNode("Dad.md", "parent", [
					tqlNode("DadsMom.md", "parent"),
					tqlNode("DadsDad.md", "parent"),
				]),
				tqlNode("Mom.md", "parent", [
					tqlNode("MomsMom.md", "parent"),
					tqlNode("MomsDad.md", "parent"),
				]),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(2);
			expect(result[0]?.members[0]?.path).toBe("Dad.md");
			expect(result[1]?.members[0]?.path).toBe("Mom.md");
		});
	});

	describe("label in relation display", () => {
		it("should include label suffix in group relations", () => {
			const nodes = [
				tqlNode("Author.md", "up", [], { label: "author" }),
				tqlNode("Series.md", "up", [], { label: "series" }),
			];
			const result = tqlTreeToGroups(nodes);

			// Different labels produce different relation strings → separate groups
			expect(result).toHaveLength(2);
			expect(result[0]?.relations).toEqual(["up.author"]);
			expect(result[1]?.relations).toEqual(["up.series"]);
		});

		it("should group nodes with same relation.label", () => {
			const nodes = [
				tqlNode("Author1.md", "up", [], { label: "author" }),
				tqlNode("Author2.md", "up", [], { label: "author" }),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(2);
			expect(result[0]?.relations).toEqual(["up.author"]);
		});

		it("should separate labeled and unlabeled same-relation nodes", () => {
			const nodes = [
				tqlNode("Author.md", "up", [], { label: "author" }),
				tqlNode("Publisher.md", "up"),
			];
			const result = tqlTreeToGroups(nodes);

			// "up.author" vs "up" → different groups
			expect(result).toHaveLength(2);
			expect(result[0]?.relations).toEqual(["up.author"]);
			expect(result[1]?.relations).toEqual(["up"]);
		});

		it("should merge same path with different labels into multi-relation", () => {
			const nodes = [
				tqlNode("Person.md", "up", [], { label: "author" }),
				tqlNode("Person.md", "down", [], { label: "editor" }),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(1);
			expect(result[0]?.members[0]?.path).toBe("Person.md");
			expect(result[0]?.members[0]?.relations).toEqual([
				"down.editor",
				"up.author",
			]);
		});
	});

	it("should preserve TQL-specific properties", () => {
		const nodes = [
			tqlNode("A.md", "parent", [], {
				hasFilteredAncestor: true,
				traversalPath: ["root.md", "A.md"],
			}),
		];
		const result = tqlTreeToGroups(nodes);

		expect(result[0]?.members[0]?.path).toBe("A.md");
	});
});

describe("tqlSubtreesEqual", () => {
	it("should return true for empty arrays", () => {
		expect(tqlSubtreesEqual([], [])).toBe(true);
	});

	it("should return false for different lengths", () => {
		const a = [tqlNode("A.md", "parent")];
		const b: QueryResultNode[] = [];
		expect(tqlSubtreesEqual(a, b)).toBe(false);
	});

	it("should return true for identical single nodes", () => {
		const a = [tqlNode("A.md", "parent")];
		const b = [tqlNode("A.md", "parent")];
		expect(tqlSubtreesEqual(a, b)).toBe(true);
	});

	it("should return false for different paths", () => {
		const a = [tqlNode("A.md", "parent")];
		const b = [tqlNode("B.md", "parent")];
		expect(tqlSubtreesEqual(a, b)).toBe(false);
	});

	it("should compare recursively", () => {
		const a = [tqlNode("A.md", "parent", [tqlNode("B.md", "parent")])];
		const b = [tqlNode("A.md", "parent", [tqlNode("B.md", "parent")])];
		expect(tqlSubtreesEqual(a, b)).toBe(true);
	});

	it("should detect different nested children", () => {
		const a = [tqlNode("A.md", "parent", [tqlNode("B.md", "parent")])];
		const b = [tqlNode("A.md", "parent", [tqlNode("C.md", "parent")])];
		expect(tqlSubtreesEqual(a, b)).toBe(false);
	});

	it("should sort by path for consistent comparison", () => {
		const a = [tqlNode("B.md", "parent"), tqlNode("A.md", "parent")];
		const b = [tqlNode("A.md", "parent"), tqlNode("B.md", "parent")];
		expect(tqlSubtreesEqual(a, b)).toBe(true);
	});
});

describe("invertDisplayGroups", () => {
	it("should return empty array for empty input", () => {
		const result = invertDisplayGroups([]);
		expect(result).toEqual([]);
	});

	it("should invert single-level group (no subgroups)", () => {
		const groups: DisplayGroup[] = [
			{
				relations: ["parent"],
				members: [
					{
						path: "A.md",
						relations: ["parent"],
						implied: false,
						properties: {},
						displayProperties: [],
					},
				],
				subgroups: [],
			},
		];
		const result = invertDisplayGroups(groups);

		expect(result).toHaveLength(1);
		expect(result[0]?.members[0]?.path).toBe("A.md");
		expect(result[0]?.subgroups).toHaveLength(0);
	});

	it("should invert two-level hierarchy", () => {
		const groups: DisplayGroup[] = [
			{
				relations: ["parent"],
				members: [
					{
						path: "Parent.md",
						relations: ["parent"],
						implied: false,
						properties: {},
						displayProperties: [],
					},
				],
				subgroups: [
					{
						relations: ["parent"],
						members: [
							{
								path: "Grandparent.md",
								relations: ["parent"],
								implied: false,
								properties: {},
								displayProperties: [],
							},
						],
						subgroups: [],
					},
				],
			},
		];
		const result = invertDisplayGroups(groups);

		expect(result).toHaveLength(1);
		expect(result[0]?.members[0]?.path).toBe("Grandparent.md");
		expect(result[0]?.subgroups).toHaveLength(1);
		expect(result[0]?.subgroups[0]?.members[0]?.path).toBe("Parent.md");
	});

	it("should handle multiple leaf nodes creating multiple roots", () => {
		const groups: DisplayGroup[] = [
			{
				relations: ["parent"],
				members: [
					{
						path: "A.md",
						relations: ["parent"],
						implied: false,
						properties: {},
						displayProperties: [],
					},
				],
				subgroups: [
					{
						relations: ["parent"],
						members: [
							{
								path: "B.md",
								relations: ["parent"],
								implied: false,
								properties: {},
								displayProperties: [],
							},
						],
						subgroups: [],
					},
					{
						relations: ["parent"],
						members: [
							{
								path: "C.md",
								relations: ["parent"],
								implied: false,
								properties: {},
								displayProperties: [],
							},
						],
						subgroups: [],
					},
				],
			},
		];
		const result = invertDisplayGroups(groups);

		expect(result).toHaveLength(2);
		expect(collectGroupPaths(result)).toContain("B.md");
		expect(collectGroupPaths(result)).toContain("C.md");
	});

	it("should preserve all members through inversion", () => {
		const groups: DisplayGroup[] = [
			{
				relations: ["parent"],
				members: [
					{
						path: "Dad.md",
						relations: ["parent"],
						implied: false,
						properties: {},
						displayProperties: [],
					},
					{
						path: "Mom.md",
						relations: ["parent"],
						implied: false,
						properties: {},
						displayProperties: [],
					},
				],
				subgroups: [
					{
						relations: ["parent"],
						members: [
							{
								path: "Grandma.md",
								relations: ["parent"],
								implied: false,
								properties: {},
								displayProperties: [],
							},
							{
								path: "Grandpa.md",
								relations: ["parent"],
								implied: false,
								properties: {},
								displayProperties: [],
							},
						],
						subgroups: [],
					},
				],
			},
		];
		const result = invertDisplayGroups(groups);

		const allPaths = collectGroupPaths(result);
		expect(allPaths).toContain("Dad.md");
		expect(allPaths).toContain("Mom.md");
		expect(allPaths).toContain("Grandma.md");
		expect(allPaths).toContain("Grandpa.md");
	});
});

describe("edge cases", () => {
	it("should handle very deep nesting", () => {
		let current = tqlNode("Node10.md", "parent");
		for (let i = 9; i >= 1; i--) {
			current = tqlNode(`Node${i}.md`, "parent", [current]);
		}
		const result = tqlTreeToGroups([current]);

		let level = result[0];
		let depth = 0;
		while (level) {
			depth++;
			level = level.subgroups[0];
		}
		expect(depth).toBe(10);
	});

	it("should handle nodes with properties", () => {
		const nodes = [
			tqlNode("A.md", "parent", [], {
				properties: { type: "person", age: 30 },
			}),
		];
		const result = tqlTreeToGroups(nodes);

		expect(result[0]?.members[0]?.properties).toEqual({
			type: "person",
			age: 30,
		});
	});

	it("should handle mixed implied and explicit relations", () => {
		const nodes = [
			tqlNode("Explicit.md", "parent", [], { implied: false }),
			tqlNode("Implied.md", "parent", [], {
				implied: true,
				impliedFrom: "child",
			}),
		];
		const result = tqlTreeToGroups(nodes);

		expect(result).toHaveLength(1);
		expect(result[0]?.members).toHaveLength(2);

		const explicit = result[0]?.members.find(
			(m) => m.path === "Explicit.md",
		);
		const implied = result[0]?.members.find((m) => m.path === "Implied.md");
		expect(explicit?.implied).toBe(false);
		expect(implied?.implied).toBe(true);
		expect(implied?.impliedFrom).toBe("child");
	});

	it("should handle diamond dependency pattern", () => {
		const sharedChild = tqlNode("A.md", "parent");
		const nodes = [
			tqlNode("B.md", "parent", [sharedChild]),
			tqlNode("C.md", "parent", [{ ...sharedChild }]),
		];
		const result = tqlTreeToGroups(nodes);

		expect(result).toHaveLength(1);
		expect(result[0]?.members).toHaveLength(2);
	});
});
