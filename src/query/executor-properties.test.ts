/**
 * TQL Executor Tests - Property Access
 * Tests for $file.properties.* syntax and nested YAML property access
 */

import {describe, it, expect} from "vitest";
import {runQuery, TestGraphs, collectPaths, type MockGraph} from "./test-utils";

describe("TQL Executor - Property Access", () => {
	describe("$file.properties.* syntax", () => {
		it("should access simple properties via $file.properties", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 where $file.properties.gender = "female"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md"); // Alice is female
			expect(paths).not.toContain("person2.md"); // Bob is male
		});

		it("should work with exists() function", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 where exists($file.properties.gender)`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md"); // has gender
			expect(paths).toContain("person2.md"); // has gender
			expect(paths).not.toContain("person3.md"); // null gender
			expect(paths).not.toContain("person4.md"); // undefined gender
		});

		it("should work with numeric comparison", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 where $file.properties.age > 27`,
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

	describe("Nested YAML properties", () => {
		/**
		 * Creates a graph with nested YAML properties
		 */
		function withNestedProperties(): MockGraph {
			return {
				files: [
					{
						path: "note1.md",
						// Simulates nested YAML: obsidian: { icon: "star", color: "blue" }
						properties: {
							title: "Note 1",
							obsidian: {icon: "star", color: "blue"},
						},
					},
					{
						path: "note2.md",
						// Simulates nested YAML: metadata: { author: "Alice", tags: { primary: "work" } }
						properties: {
							title: "Note 2",
							metadata: {
								author: "Alice",
								tags: {primary: "work"},
							},
						},
					},
					{
						path: "note3.md",
						// Flat property with dot in name (obsidian.icon: "moon")
						properties: {
							title: "Note 3",
							"obsidian.icon": "moon",
						},
					},
					{
						path: "note4.md",
						// Both nested and flat - nested should take priority
						properties: {
							title: "Note 4",
							obsidian: {icon: "sun"},
							"obsidian.icon": "should-not-appear",
						},
					},
					{
						path: "root.md",
						properties: {title: "Root"},
					},
				],
				edges: [
					{from: "root.md", to: "note1.md", relation: "down"},
					{from: "root.md", to: "note2.md", relation: "down"},
					{from: "root.md", to: "note3.md", relation: "down"},
					{from: "root.md", to: "note4.md", relation: "down"},
					{from: "note1.md", to: "root.md", relation: "up"},
					{from: "note2.md", to: "root.md", relation: "up"},
					{from: "note3.md", to: "root.md", relation: "up"},
					{from: "note4.md", to: "root.md", relation: "up"},
				],
			};
		}

		it("should access nested YAML properties", () => {
			const graph = withNestedProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 where $file.properties.obsidian.icon = "star"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("note1.md");
			expect(paths).not.toContain("note2.md");
			expect(paths).not.toContain("note3.md"); // has flat key, not nested
		});

		it("should access deeply nested YAML properties", () => {
			const graph = withNestedProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 where $file.properties.metadata.tags.primary = "work"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("note2.md");
			expect(paths).not.toContain("note1.md");
		});

		it("should fallback to flat key when nested path fails", () => {
			const graph = withNestedProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 where $file.properties.obsidian.icon = "moon"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("note3.md"); // has flat "obsidian.icon": "moon"
			expect(paths).not.toContain("note1.md");
		});

		it("should prioritize nested over flat when both exist", () => {
			const graph = withNestedProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 where $file.properties.obsidian.icon = "sun"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("note4.md"); // nested takes priority
		});

		it("should NOT find flat key when nested exists", () => {
			const graph = withNestedProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 where $file.properties.obsidian.icon = "should-not-appear"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).not.toContain("note4.md"); // nested takes priority, flat ignored
		});
	});

	describe("Direct property access (shortcut syntax)", () => {
		it("should access simple properties directly", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 where gender = "female"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("person1.md");
			expect(paths).not.toContain("person2.md");
		});

		it("should access nested properties with dot-notation", () => {
			const graph: MockGraph = {
				files: [
					{
						path: "note1.md",
						properties: {
							metadata: {author: "Alice"},
						},
					},
					{
						path: "root.md",
						properties: {},
					},
				],
				edges: [{from: "root.md", to: "note1.md", relation: "down"}],
			};

			const result = runQuery(
				`group "Test" from down :depth 1 where metadata.author = "Alice"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("note1.md");
		});
	});

	describe("Quoted property names", () => {
		/**
		 * Creates a graph with property names that need quoting
		 */
		function withSpecialPropertyNames(): MockGraph {
			return {
				files: [
					{
						path: "note1.md",
						properties: {
							"property with spaces": "value1",
							"special!chars": "value2",
							normal: "value3",
						},
					},
					{
						path: "note2.md",
						properties: {
							"property with spaces": "other",
							normal: "value4",
						},
					},
					{
						path: "root.md",
						properties: {},
					},
				],
				edges: [
					{from: "root.md", to: "note1.md", relation: "down"},
					{from: "root.md", to: "note2.md", relation: "down"},
				],
			};
		}

		it("should access properties with spaces using quoted syntax", () => {
			const graph = withSpecialPropertyNames();
			const result = runQuery(
				`group "Test" from down :depth 1 where $file.properties."property with spaces" = "value1"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("note1.md");
			expect(paths).not.toContain("note2.md");
		});

		it("should access properties with special characters using quoted syntax", () => {
			const graph = withSpecialPropertyNames();
			const result = runQuery(
				`group "Test" from down :depth 1 where $file.properties."special!chars" = "value2"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("note1.md");
			expect(paths).not.toContain("note2.md");
		});

		it("should display properties with special names", () => {
			const graph = withSpecialPropertyNames();
			const result = runQuery(
				`group "Test" from down :depth 1 display $file.properties."property with spaces"`,
				graph,
				"root.md"
			);

			const node = result.results.find((n) => n.path === "note1.md");
			expect(node).toBeDefined();
			const keys = node?.displayProperties.map(dp => dp.key);
			expect(keys).toContain("property with spaces");
		});

		it("should work with shortcut syntax and quoted segments", () => {
			const graph: MockGraph = {
				files: [
					{
						path: "note1.md",
						properties: {
							metadata: {"special key": "found"},
						},
					},
					{
						path: "root.md",
						properties: {},
					},
				],
				edges: [{from: "root.md", to: "note1.md", relation: "down"}],
			};

			const result = runQuery(
				`group "Test" from down :depth 1 where metadata."special key" = "found"`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths).toContain("note1.md");
		});
	});

	describe("Sort and display", () => {
		it("should sort by $file.properties", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 sort $file.properties.age :asc`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			// Should be sorted by age ascending: 25, 28, 30, 35
			// person2 (25), person4 (28), person1 (30), person3 (35)
			expect(paths.indexOf("person2.md")).toBeLessThan(paths.indexOf("person4.md"));
			expect(paths.indexOf("person4.md")).toBeLessThan(paths.indexOf("person1.md"));
			expect(paths.indexOf("person1.md")).toBeLessThan(paths.indexOf("person3.md"));
		});

		it("should sort by shortcut property syntax", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 sort age :asc`,
				graph,
				"root.md"
			);

			const paths = collectPaths(result.results);
			expect(paths.indexOf("person2.md")).toBeLessThan(paths.indexOf("person4.md"));
			expect(paths.indexOf("person4.md")).toBeLessThan(paths.indexOf("person1.md"));
			expect(paths.indexOf("person1.md")).toBeLessThan(paths.indexOf("person3.md"));
		});

		it("should display $file.properties", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 display $file.properties.gender, $file.properties.age`,
				graph,
				"root.md"
			);

			// Check display properties are set
			const node = result.results.find((n) => n.path === "person1.md");
			expect(node).toBeDefined();
			const keys = node?.displayProperties.map(dp => dp.key);
			expect(keys).toContain("gender");
			expect(keys).toContain("age");
		});

		it("should display shortcut property syntax", () => {
			const graph = TestGraphs.withProperties();
			const result = runQuery(
				`group "Test" from down :depth 1 display gender, age`,
				graph,
				"root.md"
			);

			const node = result.results.find((n) => n.path === "person1.md");
			expect(node).toBeDefined();
			const keys = node?.displayProperties.map(dp => dp.key);
			expect(keys).toContain("gender");
			expect(keys).toContain("age");
		});

		it("should display nested properties with shortcut syntax", () => {
			const graph: MockGraph = {
				files: [
					{
						path: "note1.md",
						properties: {
							obsidian: {icon: "star", color: "blue"},
						},
					},
					{
						path: "root.md",
						properties: {},
					},
				],
				edges: [{from: "root.md", to: "note1.md", relation: "down"}],
			};

			const result = runQuery(
				`group "Test" from down :depth 1 display obsidian.icon`,
				graph,
				"root.md"
			);

			const node = result.results.find((n) => n.path === "note1.md");
			expect(node).toBeDefined();
			const keys = node?.displayProperties.map(dp => dp.key);
			expect(keys).toContain("obsidian.icon");
		});
	});
});
