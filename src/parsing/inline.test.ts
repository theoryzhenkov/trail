/**
 * Tests for inline relation parsing
 */

import {describe, it, expect} from "vitest";
import {parseInlineRelations} from "./inline";

describe("parseInlineRelations", () => {
	describe("prefix syntax (rel::[[A]])", () => {
		it("should parse basic prefix relation", () => {
			const content = "next::[[Note A]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "next",
				target: "Note A",
			});
		});

		it("should parse multiple prefix relations", () => {
			const content = "up::[[Parent]] and down::[[Child]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(2);
			expect(result[0]?.target).toBe("Parent");
			expect(result[1]?.target).toBe("Child");
		});

		it("should normalize relation names to lowercase", () => {
			const content = "NEXT::[[Note]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(1);
			expect(result[0]?.relation).toBe("next");
		});

		it("should handle whitespace after ::", () => {
			const content = "next::  [[Note]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(1);
			expect(result[0]?.target).toBe("Note");
		});
	});

	describe("suffix syntax ([[A]]::rel)", () => {
		it("should parse basic suffix relation with targetIsCurrentFile", () => {
			const content = "[[Note A]]::next";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "next",
				target: "Note A",
				targetIsCurrentFile: true,
			});
		});

		it("should parse multiple suffix relations", () => {
			const content = "[[Parent]]::up and [[Child]]::down";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(2);
			expect(result[0]?.target).toBe("Parent");
			expect(result[0]?.targetIsCurrentFile).toBe(true);
			expect(result[1]?.target).toBe("Child");
			expect(result[1]?.targetIsCurrentFile).toBe(true);
		});
	});

	describe("triple syntax ([[A]]::rel::[[B]])", () => {
		it("should parse basic triple relation", () => {
			const content = "[[Source]]::next::[[Target]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "next",
				target: "Target",
				source: "Source",
			});
		});

		it("should parse multiple triple relations", () => {
			const content = "[[A]]::up::[[B]] and [[C]]::down::[[D]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(2);
			expect(result[0]?.source).toBe("A");
			expect(result[0]?.target).toBe("B");
			expect(result[1]?.source).toBe("C");
			expect(result[1]?.target).toBe("D");
		});

		it("should handle whitespace in triple syntax", () => {
			const content = "[[Source]]::  next  ::[[Target]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(1);
			expect(result[0]?.source).toBe("Source");
			expect(result[0]?.target).toBe("Target");
		});
	});

	describe("fan-out syntax ([[A]]::rel::[[B]]::[[C]])", () => {
		it("should parse fan-out with two targets", () => {
			const content = "[[A]]::next::[[B]]::[[C]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				relation: "next",
				target: "B",
				source: "A",
			});
			expect(result[1]).toEqual({
				relation: "next",
				target: "C",
				source: "A",
			});
		});

		it("should parse fan-out with three targets", () => {
			const content = "[[Source]]::down::[[A]]::[[B]]::[[C]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(3);
			expect(result.every(r => r.source === "Source")).toBe(true);
			expect(result.every(r => r.relation === "down")).toBe(true);
			expect(result.map(r => r.target)).toEqual(["A", "B", "C"]);
		});

		it("should handle whitespace in fan-out", () => {
			const content = "[[A]]::next::[[B]]  ::  [[C]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(2);
			expect(result[0]?.target).toBe("B");
			expect(result[1]?.target).toBe("C");
		});

		it("should not confuse fan-out with separate triples", () => {
			const content = "[[A]]::next::[[B]] some text [[C]]::up::[[D]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(2);
			expect(result[0]?.source).toBe("A");
			expect(result[0]?.target).toBe("B");
			expect(result[1]?.source).toBe("C");
			expect(result[1]?.target).toBe("D");
		});
	});

	describe("mixed syntax", () => {
		it("should parse all three syntax types in one content", () => {
			const content = `
				prefix: next::[[A]]
				suffix: [[B]]::prev
				triple: [[C]]::up::[[D]]
			`;
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(3);
			
			// Prefix: currentFile -> A
			const prefix = result.find(r => r.target === "A");
			expect(prefix?.relation).toBe("next");
			expect(prefix?.source).toBeUndefined();
			expect(prefix?.targetIsCurrentFile).toBeUndefined();
			
			// Suffix: B -> currentFile
			const suffix = result.find(r => r.target === "B");
			expect(suffix?.relation).toBe("prev");
			expect(suffix?.targetIsCurrentFile).toBe(true);
			
			// Triple: C -> D
			const triple = result.find(r => r.target === "D");
			expect(triple?.relation).toBe("up");
			expect(triple?.source).toBe("C");
		});

		it("should not double-match triple syntax as prefix+suffix", () => {
			const content = "[[A]]::next::[[B]]";
			const result = parseInlineRelations(content);
			
			// Should only have one match (triple), not three
			expect(result).toHaveLength(1);
			expect(result[0]?.source).toBe("A");
			expect(result[0]?.target).toBe("B");
		});
	});

	describe("filtering by allowed relations", () => {
		it("should filter by allowed relations", () => {
			const content = "up::[[A]] and down::[[B]] and invalid::[[C]]";
			const allowed = new Set(["up", "down"]);
			const result = parseInlineRelations(content, allowed);
			
			expect(result).toHaveLength(2);
			expect(result.map(r => r.relation)).toEqual(["up", "down"]);
		});

		it("should filter triple syntax by allowed relations", () => {
			const content = "[[A]]::up::[[B]] and [[C]]::invalid::[[D]]";
			const allowed = new Set(["up"]);
			const result = parseInlineRelations(content, allowed);
			
			expect(result).toHaveLength(1);
			expect(result[0]?.relation).toBe("up");
		});
	});

	describe("link target extraction", () => {
		it("should handle aliases in links", () => {
			const content = "next::[[Note|Alias]]";
			const result = parseInlineRelations(content);
			
			expect(result[0]?.target).toBe("Note");
		});

		it("should handle headings in links", () => {
			const content = "next::[[Note#Section]]";
			const result = parseInlineRelations(content);
			
			expect(result[0]?.target).toBe("Note");
		});

		it("should handle paths in links", () => {
			const content = "next::[[Folder/Note]]";
			const result = parseInlineRelations(content);
			
			expect(result[0]?.target).toBe("Folder/Note");
		});
	});

	describe("deduplication", () => {
		it("should deduplicate identical relations", () => {
			const content = "next::[[A]] and next::[[A]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(1);
		});

		it("should not deduplicate different targets", () => {
			const content = "next::[[A]] and next::[[B]]";
			const result = parseInlineRelations(content);
			
			expect(result).toHaveLength(2);
		});
	});
});
