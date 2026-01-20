/**
 * TQL Executor Tests - Clauses
 * Tests for WHEN, PRUNE, SORT, and DISPLAY clauses
 */

import { describe, it, expect } from "vitest";
import { runQuery, TestGraphs, collectPaths } from "./test-utils";

describe("TQL Executor - Clauses", () => {
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
				`group "Test" from down  prune level = 2`,
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
				`group "Test" from down depth 1 sort age asc`,
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
				`group "Test" from down depth 1 sort age desc`,
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
});
