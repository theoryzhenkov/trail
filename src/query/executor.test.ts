/**
 * TQL Executor Unit Tests
 */

import { describe, it, expect } from "vitest";
import { parse } from "./parser";
import { validate, createValidationContext } from "./validator";
import { execute } from "./executor";
import { createMockContext, TestGraphs, collectPaths, type MockGraph, type MockGroup } from "./test-utils";

/**
 * Helper to run a query and get results
 */
function runQuery(query: string, graph: MockGraph, activeFile: string) {
	const relations = graph.relations ?? ["up", "down", "next", "prev"];
	const groupNames = graph.groups?.map(g => g.name) ?? [];
	const validationCtx = createValidationContext(relations, groupNames);
	const ast = parse(query);
	const validated = validate(ast, validationCtx);
	const ctx = createMockContext(graph, activeFile);
	return execute(validated, ctx);
}

/**
 * Helper to create a validated query for mock groups
 */
function createMockGroup(name: string, queryStr: string, relations: string[], groupNames: string[]): MockGroup {
	const ast = parse(queryStr);
	const validationCtx = createValidationContext(relations, groupNames);
	const validated = validate(ast, validationCtx);
	return { name, query: validated };
}

describe("TQL Executor", () => {
	describe("Basic traversal", () => {
		it("should traverse down relations", () => {
			const graph = TestGraphs.simpleHierarchy();
			const result = runQuery(
				`group "Test" from down depth unlimited`,
				graph,
				"A.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			expect(paths).toContain("B.md");
			expect(paths).toContain("C.md");
			expect(paths).not.toContain("A.md"); // Active file not in results
		});

		it("should traverse up relations", () => {
			const graph = TestGraphs.simpleHierarchy();
			const result = runQuery(
				`group "Test" from up depth unlimited`,
				graph,
				"C.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			expect(paths).toContain("B.md");
			expect(paths).toContain("A.md");
		});

		it("should respect depth limit", () => {
			const graph = TestGraphs.simpleHierarchy();
			const result = runQuery(
				`group "Test" from down depth 1`,
				graph,
				"A.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			expect(paths).toContain("B.md");
			expect(paths).not.toContain("C.md"); // Beyond depth 1
		});
	});

	describe("WHERE filtering", () => {
		it("should filter by property equality", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 where gender = "female"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md"); // Alice is female
			expect(paths).not.toContain("person2.md"); // Bob is male
		});

		it("should filter by property inequality", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 where gender != "male"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md"); // Alice is female
			expect(paths).not.toContain("person2.md"); // Bob is male
			// person3 has null gender, person4 has undefined - should they be included?
		});

		it("should filter with numeric comparison", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 where age > 27`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md"); // age 30
			expect(paths).toContain("person3.md"); // age 35
			expect(paths).toContain("person4.md"); // age 28
			expect(paths).not.toContain("person2.md"); // age 25
		});
	});

	describe("Null handling", () => {
		it("should filter with exists() function", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 where exists(gender)`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md"); // has gender
			expect(paths).toContain("person2.md"); // has gender
			// person3 has null gender - should NOT be included
			expect(paths).not.toContain("person3.md");
			// person4 has undefined gender - should NOT be included
			expect(paths).not.toContain("person4.md");
		});

		it("should filter with not exists() function", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 where not exists(gender)`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).not.toContain("person1.md"); // has gender
			expect(paths).not.toContain("person2.md"); // has gender
			expect(paths).toContain("person3.md"); // null gender
			expect(paths).toContain("person4.md"); // undefined gender
		});

		it("should filter with != null", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 where gender != null`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md"); // has gender "female"
			expect(paths).toContain("person2.md"); // has gender "male"
			expect(paths).not.toContain("person3.md"); // null gender
			expect(paths).not.toContain("person4.md"); // undefined gender (treated as null)
		});

		it("should filter with = null", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 where gender = null`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).not.toContain("person1.md");
			expect(paths).not.toContain("person2.md");
			expect(paths).toContain("person3.md"); // null gender
			expect(paths).toContain("person4.md"); // undefined gender (treated as null)
		});
	});

	describe("WHEN clause", () => {
		it("should show group when condition is true", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 when exists(name)`,
				graph,
				"person1.md"
			);

			expect(result.visible).toBe(true);
		});

		it("should hide group when condition is false", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 when gender = "nonexistent"`,
				graph,
				"person1.md"
			);

			expect(result.visible).toBe(false);
			expect(result.results).toHaveLength(0);
		});
	});

	describe("PRUNE clause", () => {
		it("should stop traversal at pruned nodes", () => {
			const graph = TestGraphs.deepHierarchy();
			const result = runQuery(
				`group "Test" from down depth unlimited prune level = 2`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("a.md"); // level 1
			expect(paths).toContain("b.md"); // level 1
			// Level 2 nodes should be pruned (not included)
			expect(paths).not.toContain("a1.md");
			expect(paths).not.toContain("a2.md");
			expect(paths).not.toContain("b1.md");
			// Level 3 should also not be reached
			expect(paths).not.toContain("a1i.md");
		});
	});

	describe("SORT clause", () => {
		it("should sort by property ascending", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 sort by age asc`,
				graph,
				"root.md"
			);

			const ages = result.results.map((n) => n.properties.age as number);
			
			// Check ages are in ascending order
			for (let i = 1; i < ages.length; i++) {
				expect(ages[i]).toBeGreaterThanOrEqual(ages[i - 1]!);
			}
		});

		it("should sort by property descending", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 sort by age desc`,
				graph,
				"root.md"
			);

			const ages = result.results.map((n) => n.properties.age as number);
			
			// Check ages are in descending order
			for (let i = 1; i < ages.length; i++) {
				expect(ages[i]).toBeLessThanOrEqual(ages[i - 1]!);
			}
		});
	});

	describe("Logical operators", () => {
		it("should handle AND correctly", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 where gender = "female" and age > 25`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md"); // female, age 30
			expect(paths).not.toContain("person2.md"); // male
		});

		it("should handle OR correctly", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 where gender = "female" or age < 30`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md"); // female (age 30)
			expect(paths).toContain("person2.md"); // male, age 25 < 30
			expect(paths).toContain("person4.md"); // age 28 < 30
		});

		it("should handle NOT correctly", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 where not gender = "male"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md"); // female
			expect(paths).not.toContain("person2.md"); // male
		});
	});

	describe("Multiple relations", () => {
		it("should traverse multiple relations", () => {
			const graph = TestGraphs.sequentialChain();
			const result = runQuery(
				`group "Test" from next, prev depth 1`,
				graph,
				"chapter2.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("chapter1.md"); // prev
			expect(paths).toContain("chapter3.md"); // next
		});
	});

	describe("DISPLAY clause", () => {
		it("should include specified display properties", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down depth 1 display name, age`,
				graph,
				"root.md"
			);

			for (const node of result.results) {
				expect(node.displayProperties).toContain("name");
				expect(node.displayProperties).toContain("age");
			}
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
				`group "Test" from down depth 1 sort by номер asc`,
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
				`group "Test" from down depth 1 where № > 75 sort by № desc`,
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
				`group "Test" from down depth 1 where 優先度 = "high"`,
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
				`group "GroupA" from down depth 1 extend GroupB`,
				["up", "down"],
				["GroupA", "GroupB"]
			);
			const groupB = createMockGroup(
				"GroupB",
				`group "GroupB" from down depth 1 extend GroupA`,
				["up", "down"],
				["GroupA", "GroupB"]
			);
			graph.groups = [groupA, groupB];

			// This should complete without infinite loop
			// The cycle detection via ancestorPaths should prevent revisiting nodes
			const result = runQuery(
				`group "Test" from down depth 1 extend GroupA`,
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
				`group "Children" from down depth unlimited`,
				["down"],
				["Children"]
			);
			graph.groups = [childrenGroup];

			// Query with extend - should not infinite loop due to cycle
			const result = runQuery(
				`group "Test" from down depth unlimited`,
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
				`group "SelfRef" from down depth 1 extend SelfRef`,
				["down"],
				["SelfRef"]
			);
			graph.groups = [selfRefGroup];

			// Should complete without infinite loop
			const result = runQuery(
				`group "Test" from down depth 1 extend SelfRef`,
				graph,
				"root.md"
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			expect(paths).toContain("child.md");
		});
	});
});
