/**
 * TQL Executor Tests - Advanced Features
 * Tests for multiple relations, unicode identifiers, and extend/circular references
 */

import { describe, it, expect } from "vitest";
import { runQuery, createMockGroup, TestGraphs, collectPaths, type MockGraph } from "./test-utils";

describe("TQL Executor - Advanced Features", () => {
	describe("Multiple relations", () => {
		it("should traverse multiple relations", () => {
			const graph = TestGraphs.sequentialChain();
			const result = runQuery(
				`group "Test" from next, prev :depth 1`,
				graph,
				"chapter2.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("chapter1.md"); // prev
			expect(paths).toContain("chapter3.md"); // next
		});
	});

	describe("Unicode identifiers", () => {
		it("should parse and sort by non-Latin property names (Cyrillic)", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "item1.md", properties: { номер: 3, название: "Third" } },
					{ path: "item2.md", properties: { номер: 1, название: "First" } },
					{ path: "item3.md", properties: { номер: 2, название: "Second" } },
				],
				edges: [
					{ from: "root.md", to: "item1.md", relation: "down" },
					{ from: "root.md", to: "item2.md", relation: "down" },
					{ from: "root.md", to: "item3.md", relation: "down" },
				],
				relations: ["down"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down :depth 1 sort номер :asc`,
				graph,
				"root.md"
			);

			expect(result.visible).toBe(true);
			const numbers = result.results.map((n) => n.properties.номер as number);
			expect(numbers).toEqual([1, 2, 3]);
		});

		it("should parse and filter by special characters property (№)", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "item1.md", properties: { "№": 100 } },
					{ path: "item2.md", properties: { "№": 50 } },
					{ path: "item3.md", properties: { "№": 200 } },
				],
				edges: [
					{ from: "root.md", to: "item1.md", relation: "down" },
					{ from: "root.md", to: "item2.md", relation: "down" },
					{ from: "root.md", to: "item3.md", relation: "down" },
				],
				relations: ["down"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down :depth 1 where № > 75 sort № :desc`,
				graph,
				"root.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			expect(paths).toContain("item1.md"); // № = 100
			expect(paths).toContain("item3.md"); // № = 200
			expect(paths).not.toContain("item2.md"); // № = 50, filtered out
			
			// Check sort order (descending)
			const numbers = result.results.map((n) => n.properties["№"] as number);
			expect(numbers).toEqual([200, 100]);
		});

		it("should handle mixed Latin and non-Latin property names", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "item1.md", properties: { priority: 1, 優先度: "high" } },
					{ path: "item2.md", properties: { priority: 2, 優先度: "low" } },
				],
				edges: [
					{ from: "root.md", to: "item1.md", relation: "down" },
					{ from: "root.md", to: "item2.md", relation: "down" },
				],
				relations: ["down"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down :depth 1 where 優先度 = "high"`,
				graph,
				"root.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			expect(paths).toContain("item1.md");
			expect(paths).not.toContain("item2.md");
		});
	});

	describe("Extend with circular references", () => {
		it("should not infinite loop on circular extend (Group A extends Group B extends Group A)", () => {
			// Create a graph with hierarchy
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "child1.md", properties: {} },
					{ path: "child2.md", properties: {} },
					{ path: "grandchild.md", properties: {} },
				],
				edges: [
					{ from: "root.md", to: "child1.md", relation: "down" },
					{ from: "root.md", to: "child2.md", relation: "down" },
					{ from: "child1.md", to: "grandchild.md", relation: "down" },
					{ from: "child1.md", to: "root.md", relation: "up" },
					{ from: "child2.md", to: "root.md", relation: "up" },
					{ from: "grandchild.md", to: "child1.md", relation: "up" },
				],
				relations: ["up", "down"],
				groups: [],
			};

			// Create circular group references: GroupA extends GroupB, GroupB extends GroupA
			const groupA = createMockGroup(
				"GroupA",
				`group "GroupA" from down :depth 1 >> @"GroupB"`,
				["up", "down"],
				["GroupA", "GroupB"]
			);
			const groupB = createMockGroup(
				"GroupB",
				`group "GroupB" from down :depth 1 >> @"GroupA"`,
				["up", "down"],
				["GroupA", "GroupB"]
			);
			graph.groups = [groupA, groupB];

			// This should complete without infinite loop
			// The cycle detection via ancestorPaths should prevent revisiting nodes
			const result = runQuery(
				`group "Test" from down :depth 1 >> @"GroupA"`,
				graph,
				"root.md"
			);

			expect(result.visible).toBe(true);
			// Should have traversed some nodes without hanging
			const paths = collectPaths(result.results);
			expect(paths).toContain("child1.md");
			expect(paths).toContain("child2.md");
		});

		it("should skip already-visited nodes within same traversal path", () => {
			// Graph with a cycle: root -> a -> b -> a (cycle)
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "a.md", properties: {} },
					{ path: "b.md", properties: {} },
				],
				edges: [
					{ from: "root.md", to: "a.md", relation: "down" },
					{ from: "a.md", to: "b.md", relation: "down" },
					{ from: "b.md", to: "a.md", relation: "down" }, // Creates cycle
				],
				relations: ["down"],
				groups: [],
			};

			// Group that traverses down unlimited
			const childrenGroup = createMockGroup(
				"Children",
				`group "Children" from down `,
				["down"],
				["Children"]
			);
			graph.groups = [childrenGroup];

			// Query with extend - should not infinite loop due to cycle
			const result = runQuery(
				`group "Test" from down `,
				graph,
				"root.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			
			// Both nodes should be visited
			expect(paths).toContain("a.md");
			expect(paths).toContain("b.md");
			
			// Each node should only appear once due to cycle detection
			const aCount = paths.filter(p => p === "a.md").length;
			const bCount = paths.filter(p => p === "b.md").length;
			expect(aCount).toBe(1);
			expect(bCount).toBe(1);
		});

		it("should handle self-referencing extend gracefully", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "child.md", properties: {} },
				],
				edges: [
					{ from: "root.md", to: "child.md", relation: "down" },
				],
				relations: ["down"],
				groups: [],
			};

			// Group that extends itself
			const selfRefGroup = createMockGroup(
				"SelfRef",
				`group "SelfRef" from down :depth 1 >> @"SelfRef"`,
				["down"],
				["SelfRef"]
			);
			graph.groups = [selfRefGroup];

			// Should complete without infinite loop
			const result = runQuery(
				`group "Test" from down :depth 1 >> @"SelfRef"`,
				graph,
				"root.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			expect(paths).toContain("child.md");
		});

		it("should process chains at natural graph leaves (unlimited depth)", () => {
			// Test the bug: from up >> @"Siblings" should work when hitting natural leaf
			// Graph: Grandfather -> Dad -> Son
			// Grandfather has no parents (natural leaf)
			// Grandfather should have siblings via chain
			const graph: MockGraph = {
				files: [
					{ path: "son.md", properties: {} },
					{ path: "dad.md", properties: {} },
					{ path: "grandfather.md", properties: {} },
					{ path: "grandfather-sibling.md", properties: {} },
				],
				edges: [
					{ from: "dad.md", to: "son.md", relation: "down" },
					{ from: "grandfather.md", to: "dad.md", relation: "down" },
					{ from: "son.md", to: "dad.md", relation: "up" },
					{ from: "dad.md", to: "grandfather.md", relation: "up" },
					// Grandfather has no parents (natural leaf)
					// Grandfather has a sibling
					{ from: "grandfather.md", to: "grandfather-sibling.md", relation: "sibling" },
				],
				relations: ["up", "down", "sibling"],
				groups: [],
			};

			// Group that finds siblings
			const siblingsGroup = createMockGroup(
				"Siblings",
				`group "Siblings" from sibling`,
				["sibling"],
				["Siblings"]
			);
			graph.groups = [siblingsGroup];

			// Query: from son, go up unlimited, then find siblings at leaf nodes
			const result = runQuery(
				`group "Test" from up >> @"Siblings"`,
				graph,
				"son.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			// Should find grandfather-sibling when we reach grandfather (natural leaf)
			expect(paths).toContain("grandfather-sibling.md");
		});

		it("should process chains at natural graph leaves (with depth limit)", () => {
			// Similar test but with depth limit that doesn't reach the leaf
			const graph: MockGraph = {
				files: [
					{ path: "son.md", properties: {} },
					{ path: "dad.md", properties: {} },
					{ path: "grandfather.md", properties: {} },
					{ path: "dad-sibling.md", properties: {} },
				],
				edges: [
					{ from: "dad.md", to: "son.md", relation: "down" },
					{ from: "grandfather.md", to: "dad.md", relation: "down" },
					{ from: "son.md", to: "dad.md", relation: "up" },
					{ from: "dad.md", to: "grandfather.md", relation: "up" },
					// Dad has a sibling
					{ from: "dad.md", to: "dad-sibling.md", relation: "sibling" },
				],
				relations: ["up", "down", "sibling"],
				groups: [],
			};

			const siblingsGroup = createMockGroup(
				"Siblings",
				`group "Siblings" from sibling`,
				["sibling"],
				["Siblings"]
			);
			graph.groups = [siblingsGroup];

			// Query: from son, go up depth 1 (reaches dad), then find siblings
			const result = runQuery(
				`group "Test" from up :depth 1 >> @"Siblings"`,
				graph,
				"son.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			// Should find dad-sibling when we reach depth limit at dad
			expect(paths).toContain("dad-sibling.md");
		});

		it("should NOT process chains at starting node if it has no edges", () => {
			// Test that chains are only processed at nodes reached through traversal
			// If starting node has no edges, chains should not be processed
			const graph: MockGraph = {
				files: [
					{ path: "isolated.md", properties: {} },
					{ path: "sibling.md", properties: {} },
				],
				edges: [
					// isolated.md has no up edges (it's isolated)
					// isolated.md has a sibling, but we shouldn't find it via chain
					{ from: "isolated.md", to: "sibling.md", relation: "sibling" },
				],
				relations: ["up", "sibling"],
				groups: [],
			};

			const siblingsGroup = createMockGroup(
				"Siblings",
				`group "Siblings" from sibling`,
				["sibling"],
				["Siblings"]
			);
			graph.groups = [siblingsGroup];

			// Query: from isolated node, go up (no edges), then find siblings
			// Should NOT find siblings because we never traversed any up edges
			const result = runQuery(
				`group "Test" from up >> @"Siblings"`,
				graph,
				"isolated.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			// Should NOT find sibling because chains are only processed at nodes reached through traversal
			expect(paths).not.toContain("sibling.md");
			expect(paths).toHaveLength(0);
		});

		it("should detect cycles across chain boundaries (5C fix)", () => {
			// Graph: A -> B (down), B -> A (next)
			// Chain: from down >> next should not revisit A
			const graph: MockGraph = {
				files: [
					{path: "a.md", properties: {}},
					{path: "b.md", properties: {}},
				],
				edges: [
					{from: "a.md", to: "b.md", relation: "down"},
					{from: "b.md", to: "a.md", relation: "next"},
				],
				relations: ["down", "next"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down :depth 1 >> next`,
				graph,
				"a.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			// b.md is found via down, but a.md should NOT be found via next
			// because a.md is an ancestor in the chain
			expect(paths).toContain("b.md");
			expect(paths).not.toContain("a.md");
		});

		it("should process chains with flatten modifier", () => {
			// Test: from up :flatten >> @"Siblings" should find siblings of all ancestors
			const graph: MockGraph = {
				files: [
					{ path: "son.md", properties: {} },
					{ path: "dad.md", properties: {} },
					{ path: "grandfather.md", properties: {} },
					{ path: "dad-sibling.md", properties: {} },
					{ path: "grandfather-sibling.md", properties: {} },
				],
				edges: [
					{ from: "dad.md", to: "son.md", relation: "down" },
					{ from: "grandfather.md", to: "dad.md", relation: "down" },
					{ from: "son.md", to: "dad.md", relation: "up" },
					{ from: "dad.md", to: "grandfather.md", relation: "up" },
					// Siblings
					{ from: "dad.md", to: "dad-sibling.md", relation: "sibling" },
					{ from: "grandfather.md", to: "grandfather-sibling.md", relation: "sibling" },
				],
				relations: ["up", "down", "sibling"],
				groups: [],
			};

			const siblingsGroup = createMockGroup(
				"Siblings",
				`group "Siblings" from sibling`,
				["sibling"],
				["Siblings"]
			);
			graph.groups = [siblingsGroup];

			// Query: from son, go up with flatten, then find siblings at leaf nodes
			const result = runQuery(
				`group "Test" from up :flatten >> @"Siblings"`,
				graph,
				"son.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			// Should find dad and grandfather (flattened)
			expect(paths).toContain("dad.md");
			expect(paths).toContain("grandfather.md");
			// Should find grandfather-sibling via chain at the leaf node (grandfather)
			expect(paths).toContain("grandfather-sibling.md");
		});
	});
});
