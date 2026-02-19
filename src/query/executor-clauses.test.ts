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
				`group "Test" from down :depth 1 when exists(name)`,
				graph,
				"person1.md",
			);

			expect(result.visible).toBe(true);
		});

		it("should hide group when condition is false", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 when gender = "nonexistent"`,
				graph,
				"person1.md",
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
				"root.md",
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
				`group "Test" from down :depth 1 sort age :asc`,
				graph,
				"root.md",
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
				`group "Test" from down :depth 1 sort age :desc`,
				graph,
				"root.md",
			);

			const ages = result.results.map((n) => n.properties.age as number);

			// Check ages are in descending order
			for (let i = 1; i < ages.length; i++) {
				expect(ages[i]).toBeLessThanOrEqual(ages[i - 1]!);
			}
		});

		it("should sort by $traversal.depth", () => {
			const graph = TestGraphs.deepHierarchy();
			const result = runQuery(
				`group "Test" from down :flatten sort $traversal.depth :desc`,
				graph,
				"root.md",
			);

			expect(result.results.length).toBeGreaterThan(0);
		});
	});

	describe("Label filtering", () => {
		it("should filter by label with from up.author", () => {
			const graph = TestGraphs.withLabels();
			const result = runQuery(
				`group "Test" from up.author :depth 1`,
				graph,
				"book.md",
			);

			expect(result.visible).toBe(true);
			expect(result.results).toHaveLength(1);
			expect(result.results[0]?.path).toBe("author.md");
		});

		it("should return all edges when no label specified", () => {
			const graph = TestGraphs.withLabels();
			const result = runQuery(
				`group "Test" from up :depth 1`,
				graph,
				"book.md",
			);

			expect(result.visible).toBe(true);
			const paths = collectPaths(result.results);
			expect(paths).toContain("author.md");
			expect(paths).toContain("series.md");
			expect(paths).toContain("publisher.md");
		});

		it("should expose $traversal.label in WHERE clause", () => {
			const graph = TestGraphs.withLabels();
			const result = runQuery(
				`group "Test" from down :depth 1 where $traversal.label = "author"`,
				graph,
				"author.md",
			);

			expect(result.visible).toBe(true);
			expect(result.results).toHaveLength(1);
			expect(result.results[0]?.path).toBe("book.md");
		});

		it("should return null for $traversal.label on unlabeled edges", () => {
			const graph = TestGraphs.withLabels();
			const result = runQuery(
				`group "Test" from down :depth 1 where $traversal.label = null`,
				graph,
				"publisher.md",
			);

			expect(result.visible).toBe(true);
			expect(result.results).toHaveLength(1);
			expect(result.results[0]?.path).toBe("book.md");
		});

		it("should preserve label on result nodes", () => {
			const graph = TestGraphs.withLabels();
			const result = runQuery(
				`group "Test" from up.series :depth 1`,
				graph,
				"book.md",
			);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]?.label).toBe("series");
		});
	});

	describe("DISPLAY clause", () => {
		it("should include specified display properties", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 display name, age`,
				graph,
				"root.md",
			);

			for (const node of result.results) {
				const keys = node.displayProperties.map((dp) => dp.key);
				expect(keys).toContain("name");
				expect(keys).toContain("age");
			}
		});
	});
});
