/**
 * Tree Transforms Tests
 * Tests for grouping, inversion, and flattening of tree structures
 */

import { describe, it, expect } from "vitest";
import {
	tqlTreeToGroups,
	tqlSubtreesEqual,
	invertDisplayGroups,
	flattenTqlTree,
} from "./tree-transforms";
import type { QueryResultNode } from "../query/result";
import type { DisplayGroup } from "../types";

/**
 * Helper to create a QueryResultNode for testing
 */
function tqlNode(
	path: string,
	relation: string,
	children: QueryResultNode[] = [],
	options: Partial<QueryResultNode> = {}
): QueryResultNode {
	return {
		path,
		relation,
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
			expect(result[0]?.relation).toBe("parent");
		});

		it("should group nodes with same relation and no children", () => {
			const nodes = [
				tqlNode("Dad.md", "parent"),
				tqlNode("Mom.md", "parent"),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(2);
			expect(result[0]?.members.map(m => m.path)).toContain("Dad.md");
			expect(result[0]?.members.map(m => m.path)).toContain("Mom.md");
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
			// Dad and Mom both have the same child (Grandma)
			const grandma = tqlNode("Grandma.md", "parent");
			const nodes = [
				tqlNode("Dad.md", "parent", [grandma]),
				tqlNode("Mom.md", "parent", [{ ...grandma }]), // Same structure
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(2);
			expect(result[0]?.subgroups).toHaveLength(1);
			expect(result[0]?.subgroups[0]?.members[0]?.path).toBe("Grandma.md");
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
				tqlNode("B.md", "parent", [{ ...sharedChild }]), // Groups with A
				tqlNode("C.md", "parent", [tqlNode("Different.md", "parent")]), // Separate
			];
			const result = tqlTreeToGroups(nodes);

			expect(result).toHaveLength(2);
			// First group: A and B (identical subtrees)
			expect(result[0]?.members).toHaveLength(2);
			expect(result[0]?.members.map(m => m.path)).toContain("A.md");
			expect(result[0]?.members.map(m => m.path)).toContain("B.md");
			// Second group: C (different subtree)
			expect(result[1]?.members).toHaveLength(1);
			expect(result[1]?.members[0]?.path).toBe("C.md");
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
			expect(result[0]?.subgroups[0]?.members[0]?.path).toBe("Grandparent.md");
			expect(result[0]?.subgroups[0]?.subgroups[0]?.members[0]?.path).toBe("GreatGrandparent.md");
		});

		it("should preserve implied status through grouping", () => {
			const nodes = [
				tqlNode("A.md", "parent", [], { implied: true, impliedFrom: "child" }),
			];
			const result = tqlTreeToGroups(nodes);

			expect(result[0]?.members[0]?.implied).toBe(true);
			expect(result[0]?.members[0]?.impliedFrom).toBe("child");
		});
	});

	describe("family tree scenario", () => {
		it("should correctly group shared grandparents", () => {
			// Child -> [Dad, Mom] -> [Grandmother, Grandfather]
			// Both Dad and Mom have the same parents (Grandmother, Grandfather)
			const grandparents = [
				tqlNode("Grandmother.md", "parent"),
				tqlNode("Grandfather.md", "parent"),
			];
			const nodes = [
				tqlNode("Dad.md", "parent", grandparents),
				tqlNode("Mom.md", "parent", [...grandparents.map(g => ({ ...g }))]),
			];
			const result = tqlTreeToGroups(nodes);

			// Dad and Mom should be grouped together (same children)
			expect(result).toHaveLength(1);
			expect(result[0]?.members).toHaveLength(2);
			
			// Grandparents should also be grouped
			expect(result[0]?.subgroups).toHaveLength(1);
			expect(result[0]?.subgroups[0]?.members).toHaveLength(2);
		});

		it("should split when parents have different grandparents", () => {
			// More realistic: Dad's parents vs Mom's parents
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

			// Dad and Mom should NOT be grouped (different children)
			expect(result).toHaveLength(2);
			expect(result[0]?.members[0]?.path).toBe("Dad.md");
			expect(result[1]?.members[0]?.path).toBe("Mom.md");
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
		const groups: DisplayGroup[] = [{
			relation: "parent",
			members: [{ path: "A.md", relation: "parent", implied: false, properties: {} }],
			subgroups: [],
		}];
		const result = invertDisplayGroups(groups);

		expect(result).toHaveLength(1);
		expect(result[0]?.members[0]?.path).toBe("A.md");
		expect(result[0]?.subgroups).toHaveLength(0);
	});

	it("should invert two-level hierarchy", () => {
		// Parent -> Child becomes Child -> Parent
		const groups: DisplayGroup[] = [{
			relation: "parent",
			members: [{ path: "Parent.md", relation: "parent", implied: false, properties: {} }],
			subgroups: [{
				relation: "parent",
				members: [{ path: "Grandparent.md", relation: "parent", implied: false, properties: {} }],
				subgroups: [],
			}],
		}];
		const result = invertDisplayGroups(groups);

		// Grandparent should now be root, with Parent as child
		expect(result).toHaveLength(1);
		expect(result[0]?.members[0]?.path).toBe("Grandparent.md");
		expect(result[0]?.subgroups).toHaveLength(1);
		expect(result[0]?.subgroups[0]?.members[0]?.path).toBe("Parent.md");
	});

	it("should handle multiple leaf nodes creating multiple roots", () => {
		// A -> [B, C] becomes B -> A and C -> A (two roots)
		const groups: DisplayGroup[] = [{
			relation: "parent",
			members: [{ path: "A.md", relation: "parent", implied: false, properties: {} }],
			subgroups: [
				{
					relation: "parent",
					members: [{ path: "B.md", relation: "parent", implied: false, properties: {} }],
					subgroups: [],
				},
				{
					relation: "parent",
					members: [{ path: "C.md", relation: "parent", implied: false, properties: {} }],
					subgroups: [],
				},
			],
		}];
		const result = invertDisplayGroups(groups);

		// Two roots: B and C, each with A as child
		expect(result).toHaveLength(2);
		expect(collectGroupPaths(result)).toContain("B.md");
		expect(collectGroupPaths(result)).toContain("C.md");
	});

	it("should preserve all members through inversion", () => {
		const groups: DisplayGroup[] = [{
			relation: "parent",
			members: [
				{ path: "Dad.md", relation: "parent", implied: false, properties: {} },
				{ path: "Mom.md", relation: "parent", implied: false, properties: {} },
			],
			subgroups: [{
				relation: "parent",
				members: [
					{ path: "Grandma.md", relation: "parent", implied: false, properties: {} },
					{ path: "Grandpa.md", relation: "parent", implied: false, properties: {} },
				],
				subgroups: [],
			}],
		}];
		const result = invertDisplayGroups(groups);

		const allPaths = collectGroupPaths(result);
		expect(allPaths).toContain("Dad.md");
		expect(allPaths).toContain("Mom.md");
		expect(allPaths).toContain("Grandma.md");
		expect(allPaths).toContain("Grandpa.md");
	});
});

describe("flattenTqlTree", () => {
	it("should return empty array for empty input", () => {
		const result = flattenTqlTree([]);
		expect(result).toEqual([]);
	});

	it("should return single node without children", () => {
		const nodes = [tqlNode("A.md", "next")];
		const result = flattenTqlTree(nodes);

		expect(result).toHaveLength(1);
		expect(result[0]?.path).toBe("A.md");
		expect(result[0]?.children).toHaveLength(0);
	});

	it("should flatten nested nodes into siblings", () => {
		const nodes = [
			tqlNode("A.md", "next", [
				tqlNode("B.md", "next", [
					tqlNode("C.md", "next"),
				]),
			]),
		];
		const result = flattenTqlTree(nodes);

		expect(result).toHaveLength(3);
		expect(result[0]?.path).toBe("A.md");
		expect(result[1]?.path).toBe("B.md");
		expect(result[2]?.path).toBe("C.md");
		// All should have empty children
		expect(result.every(n => n.children.length === 0)).toBe(true);
	});

	it("should preserve order: parent before children", () => {
		const nodes = [
			tqlNode("First.md", "next", [
				tqlNode("Second.md", "next", [
					tqlNode("Third.md", "next"),
				]),
			]),
		];
		const result = flattenTqlTree(nodes);

		expect(result.map(n => n.path)).toEqual([
			"First.md",
			"Second.md",
			"Third.md",
		]);
	});

	it("should handle multiple root nodes", () => {
		const nodes = [
			tqlNode("A.md", "next", [tqlNode("A1.md", "next")]),
			tqlNode("B.md", "next", [tqlNode("B1.md", "next")]),
		];
		const result = flattenTqlTree(nodes);

		expect(result).toHaveLength(4);
		expect(result.map(n => n.path)).toEqual([
			"A.md", "A1.md", "B.md", "B1.md"
		]);
	});
});

describe("edge cases", () => {
	it("should handle very deep nesting", () => {
		// Create a chain of 10 nodes
		let current = tqlNode("Node10.md", "parent");
		for (let i = 9; i >= 1; i--) {
			current = tqlNode(`Node${i}.md`, "parent", [current]);
		}
		const result = tqlTreeToGroups([current]);

		// Should have 10 levels
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
			tqlNode("A.md", "parent", [], { properties: { type: "person", age: 30 } }),
		];
		const result = tqlTreeToGroups(nodes);

		expect(result[0]?.members[0]?.properties).toEqual({ type: "person", age: 30 });
	});

	it("should handle mixed implied and explicit relations", () => {
		const nodes = [
			tqlNode("Explicit.md", "parent", [], { implied: false }),
			tqlNode("Implied.md", "parent", [], { implied: true, impliedFrom: "child" }),
		];
		const result = tqlTreeToGroups(nodes);

		// Same relation, same subtrees (both empty) -> grouped together
		expect(result).toHaveLength(1);
		expect(result[0]?.members).toHaveLength(2);
		
		// Check implied status preserved
		const explicit = result[0]?.members.find(m => m.path === "Explicit.md");
		const implied = result[0]?.members.find(m => m.path === "Implied.md");
		expect(explicit?.implied).toBe(false);
		expect(implied?.implied).toBe(true);
		expect(implied?.impliedFrom).toBe("child");
	});

	it("should handle diamond dependency pattern", () => {
		// A is reached via B and C (both lead to same A)
		// This creates separate groups because B and C are different paths
		const sharedChild = tqlNode("A.md", "parent");
		const nodes = [
			tqlNode("B.md", "parent", [sharedChild]),
			tqlNode("C.md", "parent", [{ ...sharedChild }]),
		];
		const result = tqlTreeToGroups(nodes);

		// B and C have identical subtrees, should be grouped
		expect(result).toHaveLength(1);
		expect(result[0]?.members).toHaveLength(2);
	});
});
