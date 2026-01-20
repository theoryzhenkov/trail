/**
 * TQL Executor Tests - Chain Sorting
 * Tests for chain sorting with sequential relations
 */

import { describe, it, expect } from "vitest";
import { runQuery, type MockGraph } from "./test-utils";

describe("TQL Executor - Chain Sorting", () => {
	describe("Basic chain sorting", () => {
		it("should sort sequential chain by order of next: edges", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "chapter3.md", properties: { title: "Chapter 3" } },
					{ path: "chapter1.md", properties: { title: "Chapter 1" } },
					{ path: "chapter2.md", properties: { title: "Chapter 2" } },
				],
				edges: [
					{ from: "root.md", to: "chapter1.md", relation: "down" },
					{ from: "root.md", to: "chapter2.md", relation: "down" },
					{ from: "root.md", to: "chapter3.md", relation: "down" },
					// Sequential chain: 1 -> 2 -> 3
					{ from: "chapter1.md", to: "chapter2.md", relation: "next" },
					{ from: "chapter2.md", to: "chapter3.md", relation: "next" },
				],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth 1 sort $chain`,
				graph,
				"root.md"
			);

			const paths = result.results.map(n => n.path);
			// Chain should be in order: chapter1 -> chapter2 -> chapter3
			expect(paths).toEqual([
				"chapter1.md",
				"chapter2.md",
				"chapter3.md",
			]);
		});

		it("should respect sequential visual direction setting", () => {
			// This test verifies that chain sorting only applies to relations
			// marked as sequential in the settings
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "a.md", properties: {} },
					{ path: "b.md", properties: {} },
					{ path: "c.md", properties: {} },
				],
				edges: [
					{ from: "root.md", to: "a.md", relation: "down" },
					{ from: "root.md", to: "b.md", relation: "down" },
					{ from: "root.md", to: "c.md", relation: "down" },
					// Chain using next (which is sequential)
					{ from: "c.md", to: "a.md", relation: "next" },
					{ from: "a.md", to: "b.md", relation: "next" },
				],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth 1 sort $chain`,
				graph,
				"root.md"
			);

			const paths = result.results.map(n => n.path);
			// Chain should be: c -> a -> b (following next edges)
			expect(paths).toEqual(["c.md", "a.md", "b.md"]);
		});
	});

	describe("Circular chain handling", () => {
		it("should handle circular chains by picking alphabetically first as head", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "b.md", properties: {} },
					{ path: "c.md", properties: {} },
					{ path: "a.md", properties: {} },
				],
				edges: [
					{ from: "root.md", to: "a.md", relation: "down" },
					{ from: "root.md", to: "b.md", relation: "down" },
					{ from: "root.md", to: "c.md", relation: "down" },
					// Circular chain: a -> b -> c -> a
					{ from: "a.md", to: "b.md", relation: "next" },
					{ from: "b.md", to: "c.md", relation: "next" },
					{ from: "c.md", to: "a.md", relation: "next" },
				],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth 1 sort $chain`,
				graph,
				"root.md"
			);

			const paths = result.results.map(n => n.path);
			// "a" is alphabetically first, so chain starts with a
			expect(paths[0]).toBe("a.md");
			// All three should be present
			expect(paths).toHaveLength(3);
			expect(paths).toContain("a.md");
			expect(paths).toContain("b.md");
			expect(paths).toContain("c.md");
		});
	});

	describe("Mixed chains and disconnected nodes", () => {
		it("should sort chains together, disconnected nodes by properties", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "part1.md", properties: { order: 1 } },
					{ path: "part2.md", properties: { order: 2 } },
					{ path: "standalone.md", properties: { order: 0 } },
				],
				edges: [
					{ from: "root.md", to: "part1.md", relation: "down" },
					{ from: "root.md", to: "part2.md", relation: "down" },
					{ from: "root.md", to: "standalone.md", relation: "down" },
					// Chain: part1 -> part2
					{ from: "part1.md", to: "part2.md", relation: "next" },
				],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth 1 sort $chain, order asc`,
				graph,
				"root.md"
			);

			const paths = result.results.map(n => n.path);
			// standalone has order 0, part1 chain has order 1
			// With chain as primary, chains stay together
			// standalone (order 0) should come before part1 chain (order 1)
			expect(paths[0]).toBe("standalone.md");
			// Chain should follow: part1 -> part2
			expect(paths.indexOf("part1.md")).toBeLessThan(paths.indexOf("part2.md"));
		});

		it("should handle multiple separate chains", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "chain1-a.md", properties: { group: "1" } },
					{ path: "chain1-b.md", properties: { group: "1" } },
					{ path: "chain2-a.md", properties: { group: "2" } },
					{ path: "chain2-b.md", properties: { group: "2" } },
				],
				edges: [
					{ from: "root.md", to: "chain1-a.md", relation: "down" },
					{ from: "root.md", to: "chain1-b.md", relation: "down" },
					{ from: "root.md", to: "chain2-a.md", relation: "down" },
					{ from: "root.md", to: "chain2-b.md", relation: "down" },
					// Chain 1: a -> b
					{ from: "chain1-a.md", to: "chain1-b.md", relation: "next" },
					// Chain 2: a -> b
					{ from: "chain2-a.md", to: "chain2-b.md", relation: "next" },
				],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth 1 sort $chain`,
				graph,
				"root.md"
			);

			const paths = result.results.map(n => n.path);
			// Both chains should be intact
			expect(paths.indexOf("chain1-a.md")).toBeLessThan(paths.indexOf("chain1-b.md"));
			expect(paths.indexOf("chain2-a.md")).toBeLessThan(paths.indexOf("chain2-b.md"));
		});
	});

	describe("Chain sort with property sorting", () => {
		it("should sort by property first when chain is secondary", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "high-a.md", properties: { priority: "high" } },
					{ path: "high-b.md", properties: { priority: "high" } },
					{ path: "low-a.md", properties: { priority: "low" } },
					{ path: "low-b.md", properties: { priority: "low" } },
				],
				edges: [
					{ from: "root.md", to: "high-a.md", relation: "down" },
					{ from: "root.md", to: "high-b.md", relation: "down" },
					{ from: "root.md", to: "low-a.md", relation: "down" },
					{ from: "root.md", to: "low-b.md", relation: "down" },
					// Cross-priority chain: low-a -> high-a
					{ from: "low-a.md", to: "high-a.md", relation: "next" },
					// Within-priority chain: high-b -> (nothing)
					{ from: "high-a.md", to: "high-b.md", relation: "next" },
				],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth 1 sort priority asc, $chain`,
				graph,
				"root.md"
			);

			const paths = result.results.map(n => n.path);
			// Priority sorting first: high before low (alphabetically)
			const highIndices = paths
				.map((p, i) => p.includes("high") ? i : -1)
				.filter(i => i >= 0);
			const lowIndices = paths
				.map((p, i) => p.includes("low") ? i : -1)
				.filter(i => i >= 0);
			
			// All high items should come before all low items
			expect(Math.max(...highIndices)).toBeLessThan(Math.min(...lowIndices));
		});
	});

	describe("Edge cases", () => {
		it("should handle empty result set", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
				],
				edges: [],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth 1 sort $chain`,
				graph,
				"root.md"
			);

			expect(result.results).toHaveLength(0);
		});

		it("should handle single node (no chains possible)", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "single.md", properties: {} },
				],
				edges: [
					{ from: "root.md", to: "single.md", relation: "down" },
				],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth 1 sort $chain`,
				graph,
				"root.md"
			);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]?.path).toBe("single.md");
		});

		it("should handle no sequential relations (falls back to alphabetical)", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "b.md", properties: {} },
					{ path: "a.md", properties: {} },
					{ path: "c.md", properties: {} },
				],
				edges: [
					{ from: "root.md", to: "b.md", relation: "down" },
					{ from: "root.md", to: "a.md", relation: "down" },
					{ from: "root.md", to: "c.md", relation: "down" },
					// Using down relation (not sequential)
					{ from: "a.md", to: "b.md", relation: "down" },
				],
				relations: ["down", "up"], // No next/prev
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth 1 sort $chain`,
				graph,
				"root.md"
			);

			const paths = result.results.map(n => n.path);
			// Should fall back to alphabetical when no sequential relations exist
			expect(paths).toEqual(["a.md", "b.md", "c.md"]);
		});

		it("should handle chain sorting at nested levels", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "parent.md", properties: {} },
					{ path: "child1.md", properties: {} },
					{ path: "child2.md", properties: {} },
					{ path: "child3.md", properties: {} },
				],
				edges: [
					{ from: "root.md", to: "parent.md", relation: "down" },
					{ from: "parent.md", to: "child1.md", relation: "down" },
					{ from: "parent.md", to: "child2.md", relation: "down" },
					{ from: "parent.md", to: "child3.md", relation: "down" },
					// Chain among children
					{ from: "child3.md", to: "child1.md", relation: "next" },
					{ from: "child1.md", to: "child2.md", relation: "next" },
				],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth unlimited sort $chain`,
				graph,
				"root.md"
			);

			// Check that children are sorted correctly
			const parent = result.results.find(n => n.path === "parent.md");
			expect(parent).toBeDefined();
			const childPaths = parent!.children.map(c => c.path);
			expect(childPaths).toEqual(["child3.md", "child1.md", "child2.md"]);
		});
	});

	describe("Regression tests", () => {
		it("should correctly sort the sequential chain example from docs", () => {
			// Based on docs/configuration/sorting.md example
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "day1.md", properties: { date: "2024-01-01" } },
					{ path: "day2.md", properties: { date: "2024-01-02" } },
					{ path: "day3.md", properties: { date: "2024-01-03" } },
				],
				edges: [
					{ from: "root.md", to: "day1.md", relation: "down" },
					{ from: "root.md", to: "day2.md", relation: "down" },
					{ from: "root.md", to: "day3.md", relation: "down" },
					// Sequential chain
					{ from: "day1.md", to: "day2.md", relation: "next" },
					{ from: "day2.md", to: "day3.md", relation: "next" },
				],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Days" from down depth 1 sort $chain, date asc`,
				graph,
				"root.md"
			);

			const paths = result.results.map(n => n.path);
			expect(paths).toEqual(["day1.md", "day2.md", "day3.md"]);
		});

		it("should work with prev relation chains", () => {
			const graph: MockGraph = {
				files: [
					{ path: "root.md", properties: {} },
					{ path: "last.md", properties: {} },
					{ path: "middle.md", properties: {} },
					{ path: "first.md", properties: {} },
				],
				edges: [
					{ from: "root.md", to: "last.md", relation: "down" },
					{ from: "root.md", to: "middle.md", relation: "down" },
					{ from: "root.md", to: "first.md", relation: "down" },
					// prev chain: last -> middle -> first
					{ from: "last.md", to: "middle.md", relation: "prev" },
					{ from: "middle.md", to: "first.md", relation: "prev" },
				],
				relations: ["down", "next", "prev"],
				groups: [],
			};

			const result = runQuery(
				`group "Test" from down depth 1 sort $chain`,
				graph,
				"root.md"
			);

			const paths = result.results.map(n => n.path);
			// prev is also sequential, so chain should be: last -> middle -> first
			expect(paths.indexOf("last.md")).toBeLessThan(paths.indexOf("middle.md"));
			expect(paths.indexOf("middle.md")).toBeLessThan(paths.indexOf("first.md"));
		});
	});
});
