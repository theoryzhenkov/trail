/**
 * TQL Executor Tests - Filtering
 * Tests for WHERE clauses, null handling, and logical operators
 */

import { describe, it, expect } from "vitest";
import { runQuery, TestGraphs, collectPaths } from "./test-utils";

describe("TQL Executor - Filtering", () => {
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
});
