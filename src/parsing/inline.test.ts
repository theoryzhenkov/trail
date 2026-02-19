/**
 * Tests for inline relation parsing
 */

import { describe, it, expect } from "vitest";
import { parseInlineRelations } from "./inline";

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
		it("should parse basic suffix relation (source -> currentFile)", () => {
			const content = "[[Note A]]::next";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "next",
				source: "Note A",
			});
		});

		it("should parse multiple suffix relations", () => {
			const content = "[[Parent]]::up and [[Child]]::down";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(2);
			expect(result[0]?.source).toBe("Parent");
			expect(result[0]?.target).toBeUndefined();
			expect(result[1]?.source).toBe("Child");
			expect(result[1]?.target).toBeUndefined();
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
			expect(result.every((r) => r.source === "Source")).toBe(true);
			expect(result.every((r) => r.relation === "down")).toBe(true);
			expect(result.map((r) => r.target)).toEqual(["A", "B", "C"]);
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

	describe("chain syntax (::-::)", () => {
		it("should parse basic chain", () => {
			const content = "[[A]]::next::[[B]]::-::[[C]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(2);
			// First: A -> B
			expect(result[0]).toEqual({
				relation: "next",
				target: "B",
				source: "A",
			});
			// Chain: B -> C
			expect(result[1]).toEqual({
				relation: "next",
				target: "C",
				source: "B",
			});
		});

		it("should parse longer chain", () => {
			const content = "[[A]]::next::[[B]]::-::[[C]]::-::[[D]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(3);
			expect(result[0]).toEqual({
				relation: "next",
				target: "B",
				source: "A",
			});
			expect(result[1]).toEqual({
				relation: "next",
				target: "C",
				source: "B",
			});
			expect(result[2]).toEqual({
				relation: "next",
				target: "D",
				source: "C",
			});
		});

		it("should handle whitespace in chain", () => {
			const content = "[[A]]::next::[[B]]  ::-::  [[C]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(2);
			expect(result[1]?.source).toBe("B");
			expect(result[1]?.target).toBe("C");
		});

		it("should support mixed fan-out and chain", () => {
			// A -> B, A -> C, C -> D
			const content = "[[A]]::next::[[B]]::[[C]]::-::[[D]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(3);
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
			expect(result[2]).toEqual({
				relation: "next",
				target: "D",
				source: "C",
			});
		});

		it("should chain from last target in mixed patterns", () => {
			// A -> B, B -> C, A -> D, D -> E
			const content = "[[A]]::next::[[B]]::-::[[C]]::[[D]]::-::[[E]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(4);
			expect(result[0]).toEqual({
				relation: "next",
				target: "B",
				source: "A",
			});
			expect(result[1]).toEqual({
				relation: "next",
				target: "C",
				source: "B",
			});
			expect(result[2]).toEqual({
				relation: "next",
				target: "D",
				source: "A",
			}); // fan-out from A
			expect(result[3]).toEqual({
				relation: "next",
				target: "E",
				source: "D",
			}); // chain from D
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

			// Prefix: currentFile -> A (source undefined, target = A)
			const prefix = result.find((r) => r.target === "A");
			expect(prefix?.relation).toBe("next");
			expect(prefix?.source).toBeUndefined();

			// Suffix: B -> currentFile (source = B, target undefined)
			const suffix = result.find((r) => r.source === "B");
			expect(suffix?.relation).toBe("prev");
			expect(suffix?.target).toBeUndefined();

			// Triple: C -> D
			const triple = result.find((r) => r.target === "D");
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
			expect(result.map((r) => r.relation)).toEqual(["up", "down"]);
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

	describe("context tracking", () => {
		it("should use context from prefix pattern for continuation", () => {
			const content = `next::[[A]]
Some text here
::[[B]]`;
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(2);
			// Both should have currentFile as source (no source field)
			expect(result[0]).toEqual({ relation: "next", target: "A" });
			expect(result[1]).toEqual({ relation: "next", target: "B" });
		});

		it("should use context from suffix pattern for continuation", () => {
			const content = `[[Source]]::next
::[[A]]
::[[B]]`;
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(2);
			// Source -> A and Source -> B (no edge to currentFile)
			expect(result[0]).toEqual({
				relation: "next",
				target: "A",
				source: "Source",
			});
			expect(result[1]).toEqual({
				relation: "next",
				target: "B",
				source: "Source",
			});
		});

		it("should create edge to currentFile if suffix has no continuation", () => {
			const content = "[[A]]::next";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({ relation: "next", source: "A" });
		});

		it("should use context for chain continuation", () => {
			const content = `[[A]]::next::[[B]]
some text
::-::[[C]]`;
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
				source: "B",
			});
		});

		it("should update context when new relation appears", () => {
			const content = `[[A]]::next
::[[B]]
[[C]]::prev
::[[D]]`;
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(2);
			// A -> B with next relation
			expect(result[0]).toEqual({
				relation: "next",
				target: "B",
				source: "A",
			});
			// C -> D with prev relation
			expect(result[1]).toEqual({
				relation: "prev",
				target: "D",
				source: "C",
			});
		});

		it("should ignore standalone continuation with no context", () => {
			const content = "Some text ::[[A]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(0);
		});

		it("should chain from currentFile when lastTarget is null", () => {
			const content = `[[A]]::next
::-::[[B]]`;
			const result = parseInlineRelations(content);

			// [[A]]::next creates A -> currentFile, sets lastTarget = null (currentFile)
			// ::-::[[B]] chains from currentFile -> B
			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({ relation: "next", source: "A" });
			expect(result[1]).toEqual({ relation: "next", target: "B" }); // source undefined = currentFile
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

		it("should not deduplicate different sources with same target", () => {
			const content = "[[C]]::up::[[A]] and [[D]]::up::[[A]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(2);
			expect(result[0]?.source).toBe("C");
			expect(result[0]?.target).toBe("A");
			expect(result[1]?.source).toBe("D");
			expect(result[1]?.target).toBe("A");
		});
	});

	describe("labeled relations (dot notation)", () => {
		it("should parse prefix with label", () => {
			const content = "up.author::[[John]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "up",
				label: "author",
				target: "John",
			});
		});

		it("should parse suffix with label", () => {
			const content = "[[John]]::up.author";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "up",
				label: "author",
				source: "John",
			});
		});

		it("should parse triple with label", () => {
			const content = "[[A]]::up.author::[[B]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "up",
				label: "author",
				target: "B",
				source: "A",
			});
		});

		it("should lowercase the label", () => {
			const content = "up.Author::[[John]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]?.relation).toBe("up");
			expect(result[0]?.label).toBe("author");
		});

		it("should have no label when dot notation is not used", () => {
			const content = "up::[[John]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]?.relation).toBe("up");
			expect(result[0]?.label).toBeUndefined();
		});

		it("should carry label through fan-out", () => {
			const content = "up.author::[[A]]::[[B]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				relation: "up",
				label: "author",
				target: "A",
			});
			expect(result[1]).toEqual({
				relation: "up",
				label: "author",
				target: "B",
			});
		});

		it("should carry label through chain", () => {
			const content = "up.author::[[A]]::-::[[B]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				relation: "up",
				label: "author",
				target: "A",
			});
			expect(result[1]).toEqual({
				relation: "up",
				label: "author",
				target: "B",
				source: "A",
			});
		});

		it("should filter labeled relations by base relation name", () => {
			const content = "up.author::[[A]] and down.editor::[[B]]";
			const allowed = new Set(["up"]);
			const result = parseInlineRelations(content, allowed);

			expect(result).toHaveLength(1);
			expect(result[0]?.relation).toBe("up");
			expect(result[0]?.label).toBe("author");
		});

		it("should parse multi-segment dotted label path (prefix)", () => {
			const content = "up.author.primary::[[John]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "up",
				label: "author.primary",
				target: "John",
			});
		});

		it("should parse multi-segment dotted label path (suffix)", () => {
			const content = "[[John]]::up.author.primary";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "up",
				label: "author.primary",
				source: "John",
			});
		});

		it("should parse multi-segment dotted label path (triple)", () => {
			const content = "[[A]]::up.author.primary::[[B]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "up",
				label: "author.primary",
				target: "B",
				source: "A",
			});
		});

		it("should parse three-segment dotted label path", () => {
			const content = "up.foo.bar.baz::[[X]]";
			const result = parseInlineRelations(content);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				relation: "up",
				label: "foo.bar.baz",
				target: "X",
			});
		});
	});
});
