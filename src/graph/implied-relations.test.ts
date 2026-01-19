/**
 * Implied Relations Tests
 * Tests for applying implied relation rules to edges
 */

import {describe, it, expect} from "vitest";
import {applyImpliedRules} from "./implied-relations";
import type {RelationDefinition, RelationEdge} from "../types";

/**
 * Helper to create an edge for testing
 */
function edge(
	fromPath: string,
	toPath: string,
	relation: string,
	implied = false,
	impliedFrom?: string
): RelationEdge {
	return {fromPath, toPath, relation, implied, impliedFrom};
}

/**
 * Helper to create a relation definition for testing
 */
function relation(
	name: string,
	impliedRelations: RelationDefinition["impliedRelations"] = []
): RelationDefinition {
	return {name, aliases: [], impliedRelations};
}

/**
 * Helper to check if an edge exists in the result
 */
function hasEdge(
	edges: RelationEdge[],
	fromPath: string,
	toPath: string,
	relation: string
): boolean {
	return edges.some(
		(e) => e.fromPath === fromPath && e.toPath === toPath && e.relation === relation
	);
}

describe("applyImpliedRules", () => {
	describe("basic behavior", () => {
		it("should return edges unchanged when no relations defined", () => {
			const edges = [edge("A.md", "B.md", "up")];
			const result = applyImpliedRules(edges, []);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(edges[0]);
		});

		it("should return edges unchanged when no implied rules match", () => {
			const edges = [edge("A.md", "B.md", "up")];
			const relations = [relation("down")];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(edges[0]);
		});
	});

	describe("forward direction", () => {
		it("should create forward implied edge", () => {
			const edges = [edge("A.md", "B.md", "up")];
			const relations = [
				relation("up", [{targetRelation: "parent", direction: "forward"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(2);
			expect(hasEdge(result, "A.md", "B.md", "up")).toBe(true);
			expect(hasEdge(result, "A.md", "B.md", "parent")).toBe(true);

			const impliedEdge = result.find((e) => e.relation === "parent");
			expect(impliedEdge?.implied).toBe(true);
			expect(impliedEdge?.impliedFrom).toBe("up");
		});
	});

	describe("reverse direction", () => {
		it("should create reverse implied edge", () => {
			const edges = [edge("A.md", "B.md", "up")];
			const relations = [
				relation("up", [{targetRelation: "down", direction: "reverse"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(2);
			expect(hasEdge(result, "A.md", "B.md", "up")).toBe(true);
			expect(hasEdge(result, "B.md", "A.md", "down")).toBe(true);

			const impliedEdge = result.find((e) => e.relation === "down");
			expect(impliedEdge?.implied).toBe(true);
			expect(impliedEdge?.impliedFrom).toBe("up");
		});
	});

	describe("both direction", () => {
		it("should create both forward and reverse implied edges", () => {
			const edges = [edge("A.md", "B.md", "related")];
			const relations = [
				relation("related", [{targetRelation: "linked", direction: "both"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(3);
			expect(hasEdge(result, "A.md", "B.md", "related")).toBe(true);
			expect(hasEdge(result, "A.md", "B.md", "linked")).toBe(true);
			expect(hasEdge(result, "B.md", "A.md", "linked")).toBe(true);
		});
	});

	describe("self-implication (symmetric relations)", () => {
		it("should allow relation to imply itself in reverse direction", () => {
			// This is the key test for issue #7: symmetric relations like "same"
			const edges = [edge("A.md", "B.md", "same")];
			const relations = [
				relation("same", [{targetRelation: "same", direction: "reverse"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(2);
			expect(hasEdge(result, "A.md", "B.md", "same")).toBe(true);
			expect(hasEdge(result, "B.md", "A.md", "same")).toBe(true);

			const impliedEdge = result.find(
				(e) => e.fromPath === "B.md" && e.toPath === "A.md"
			);
			expect(impliedEdge?.implied).toBe(true);
			expect(impliedEdge?.impliedFrom).toBe("same");
		});

		it("should not duplicate edge when self-implying forward", () => {
			// Forward self-implication should be a no-op (same edge already exists)
			const edges = [edge("A.md", "B.md", "same")];
			const relations = [
				relation("same", [{targetRelation: "same", direction: "forward"}])
			];
			const result = applyImpliedRules(edges, relations);

			// Should not create duplicate - only original edge
			expect(result).toHaveLength(1);
			expect(result[0]?.fromPath).toBe("A.md");
			expect(result[0]?.toPath).toBe("B.md");
		});

		it("should handle self-implication with both direction", () => {
			const edges = [edge("A.md", "B.md", "related")];
			const relations = [
				relation("related", [{targetRelation: "related", direction: "both"}])
			];
			const result = applyImpliedRules(edges, relations);

			// Should have original + reverse (forward is duplicate, skipped)
			expect(result).toHaveLength(2);
			expect(hasEdge(result, "A.md", "B.md", "related")).toBe(true);
			expect(hasEdge(result, "B.md", "A.md", "related")).toBe(true);
		});

		it("should handle multiple files with symmetric relations", () => {
			const edges = [
				edge("A.md", "B.md", "same"),
				edge("B.md", "C.md", "same")
			];
			const relations = [
				relation("same", [{targetRelation: "same", direction: "reverse"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(4);
			expect(hasEdge(result, "A.md", "B.md", "same")).toBe(true);
			expect(hasEdge(result, "B.md", "A.md", "same")).toBe(true);
			expect(hasEdge(result, "B.md", "C.md", "same")).toBe(true);
			expect(hasEdge(result, "C.md", "B.md", "same")).toBe(true);
		});

		it("should not create duplicate when explicit reverse already exists", () => {
			// If user already defined both directions explicitly
			const edges = [
				edge("A.md", "B.md", "same"),
				edge("B.md", "A.md", "same")
			];
			const relations = [
				relation("same", [{targetRelation: "same", direction: "reverse"}])
			];
			const result = applyImpliedRules(edges, relations);

			// Should still be 2 edges, no duplicates created
			expect(result).toHaveLength(2);
		});
	});

	describe("sibling direction", () => {
		it("should create sibling edges between nodes sharing same target", () => {
			const edges = [
				edge("Child1.md", "Parent.md", "up"),
				edge("Child2.md", "Parent.md", "up")
			];
			const relations = [
				relation("up", [{targetRelation: "sibling", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(4);
			expect(hasEdge(result, "Child1.md", "Parent.md", "up")).toBe(true);
			expect(hasEdge(result, "Child2.md", "Parent.md", "up")).toBe(true);
			expect(hasEdge(result, "Child1.md", "Child2.md", "sibling")).toBe(true);
			expect(hasEdge(result, "Child2.md", "Child1.md", "sibling")).toBe(true);
		});

		it("should create sibling edges for three or more siblings", () => {
			const edges = [
				edge("A.md", "Parent.md", "up"),
				edge("B.md", "Parent.md", "up"),
				edge("C.md", "Parent.md", "up")
			];
			const relations = [
				relation("up", [{targetRelation: "sibling", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			// 3 original + 6 sibling edges (3 pairs, bidirectional)
			expect(result).toHaveLength(9);
			expect(hasEdge(result, "A.md", "B.md", "sibling")).toBe(true);
			expect(hasEdge(result, "B.md", "A.md", "sibling")).toBe(true);
			expect(hasEdge(result, "A.md", "C.md", "sibling")).toBe(true);
			expect(hasEdge(result, "C.md", "A.md", "sibling")).toBe(true);
			expect(hasEdge(result, "B.md", "C.md", "sibling")).toBe(true);
			expect(hasEdge(result, "C.md", "B.md", "sibling")).toBe(true);
		});

		it("should not create sibling edges for single child", () => {
			const edges = [edge("OnlyChild.md", "Parent.md", "up")];
			const relations = [
				relation("up", [{targetRelation: "sibling", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(1);
		});
	});

	describe("multiple implied relations", () => {
		it("should apply multiple implied rules from same relation", () => {
			const edges = [edge("A.md", "B.md", "up")];
			const relations = [
				relation("up", [
					{targetRelation: "down", direction: "reverse"},
					{targetRelation: "parent", direction: "forward"}
				])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(3);
			expect(hasEdge(result, "A.md", "B.md", "up")).toBe(true);
			expect(hasEdge(result, "B.md", "A.md", "down")).toBe(true);
			expect(hasEdge(result, "A.md", "B.md", "parent")).toBe(true);
		});
	});

	describe("case handling", () => {
		it("should normalize implied relation names to lowercase", () => {
			const edges = [edge("A.md", "B.md", "up")];
			const relations = [
				relation("UP", [{targetRelation: "DOWN", direction: "reverse"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(2);
			// The implied relation should be normalized to lowercase
			expect(hasEdge(result, "B.md", "A.md", "down")).toBe(true);
		});

		it("should match edges case-sensitively (edges should be pre-normalized)", () => {
			// Edge relations are expected to already be lowercase from parsing
			const edges = [edge("A.md", "B.md", "up")];
			const relations = [
				relation("up", [{targetRelation: "down", direction: "reverse"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(2);
			expect(hasEdge(result, "B.md", "A.md", "down")).toBe(true);
		});
	});

	describe("edge cases", () => {
		it("should handle empty edge list", () => {
			const relations = [
				relation("up", [{targetRelation: "down", direction: "reverse"}])
			];
			const result = applyImpliedRules([], relations);

			expect(result).toHaveLength(0);
		});

		it("should skip rules with empty relation names", () => {
			const edges = [edge("A.md", "B.md", "up")];
			const relations = [relation("up", [{targetRelation: "", direction: "reverse"}])];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(1);
		});

		it("should skip relations with empty names", () => {
			const edges = [edge("A.md", "B.md", "up")];
			const relations = [
				relation("", [{targetRelation: "down", direction: "reverse"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(1);
		});
	});
});
