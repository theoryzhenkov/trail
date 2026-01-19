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

	describe("sibling direction (up-style: shared target)", () => {
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

	describe("sibling direction (down-style: shared source)", () => {
		it("should create sibling edges between targets sharing same source", () => {
			// This is the key test for issue #9: down relations creating siblings
			// Parent -> B and Parent -> C means B and C are siblings
			const edges = [
				edge("Parent.md", "B.md", "down"),
				edge("Parent.md", "C.md", "down")
			];
			const relations = [
				relation("down", [{targetRelation: "same", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(4);
			expect(hasEdge(result, "Parent.md", "B.md", "down")).toBe(true);
			expect(hasEdge(result, "Parent.md", "C.md", "down")).toBe(true);
			expect(hasEdge(result, "B.md", "C.md", "same")).toBe(true);
			expect(hasEdge(result, "C.md", "B.md", "same")).toBe(true);

			// Verify implied edges are marked correctly
			const impliedEdges = result.filter((e) => e.implied);
			expect(impliedEdges).toHaveLength(2);
			for (const ie of impliedEdges) {
				expect(ie.impliedFrom).toBe("down");
			}
		});

		it("should create sibling edges for three or more children from same parent", () => {
			const edges = [
				edge("Parent.md", "A.md", "down"),
				edge("Parent.md", "B.md", "down"),
				edge("Parent.md", "C.md", "down")
			];
			const relations = [
				relation("down", [{targetRelation: "sibling", direction: "sibling"}])
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

		it("should not create sibling edges for single child from parent", () => {
			const edges = [edge("Parent.md", "OnlyChild.md", "down")];
			const relations = [
				relation("down", [{targetRelation: "sibling", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(1);
		});

		it("should handle multiple parents with their own children", () => {
			// Parent1 -> A, B and Parent2 -> C, D
			// A and B should be siblings, C and D should be siblings
			// but A and C should NOT be siblings (different parents)
			const edges = [
				edge("Parent1.md", "A.md", "down"),
				edge("Parent1.md", "B.md", "down"),
				edge("Parent2.md", "C.md", "down"),
				edge("Parent2.md", "D.md", "down")
			];
			const relations = [
				relation("down", [{targetRelation: "sibling", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			// 4 original + 4 sibling edges (2 pairs from each parent, bidirectional)
			expect(result).toHaveLength(8);
			
			// Parent1's children are siblings
			expect(hasEdge(result, "A.md", "B.md", "sibling")).toBe(true);
			expect(hasEdge(result, "B.md", "A.md", "sibling")).toBe(true);
			
			// Parent2's children are siblings
			expect(hasEdge(result, "C.md", "D.md", "sibling")).toBe(true);
			expect(hasEdge(result, "D.md", "C.md", "sibling")).toBe(true);
			
			// Children from different parents are NOT siblings
			expect(hasEdge(result, "A.md", "C.md", "sibling")).toBe(false);
			expect(hasEdge(result, "A.md", "D.md", "sibling")).toBe(false);
			expect(hasEdge(result, "B.md", "C.md", "sibling")).toBe(false);
			expect(hasEdge(result, "B.md", "D.md", "sibling")).toBe(false);
		});

		it("should work with different implied relation names", () => {
			const edges = [
				edge("Project.md", "Task1.md", "tasks"),
				edge("Project.md", "Task2.md", "tasks")
			];
			const relations = [
				relation("tasks", [{targetRelation: "related-task", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			expect(result).toHaveLength(4);
			expect(hasEdge(result, "Task1.md", "Task2.md", "related-task")).toBe(true);
			expect(hasEdge(result, "Task2.md", "Task1.md", "related-task")).toBe(true);
		});
	});

	describe("sibling direction (combined up and down)", () => {
		it("should handle both up and down sibling rules simultaneously", () => {
			const edges = [
				// Up-style: Children pointing to same parent
				edge("Child1.md", "Parent.md", "up"),
				edge("Child2.md", "Parent.md", "up"),
				// Down-style: Parent pointing to children
				edge("Parent.md", "Descendant1.md", "down"),
				edge("Parent.md", "Descendant2.md", "down")
			];
			const relations = [
				relation("up", [{targetRelation: "up-sibling", direction: "sibling"}]),
				relation("down", [{targetRelation: "down-sibling", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			// 4 original + 2 up-sibling + 2 down-sibling = 8
			expect(result).toHaveLength(8);
			
			// Up-style siblings
			expect(hasEdge(result, "Child1.md", "Child2.md", "up-sibling")).toBe(true);
			expect(hasEdge(result, "Child2.md", "Child1.md", "up-sibling")).toBe(true);
			
			// Down-style siblings
			expect(hasEdge(result, "Descendant1.md", "Descendant2.md", "down-sibling")).toBe(true);
			expect(hasEdge(result, "Descendant2.md", "Descendant1.md", "down-sibling")).toBe(true);
		});

		it("should not create duplicates when same nodes appear in both styles", () => {
			// Edge case: what if we have edges that would create the same sibling pair
			// from both up and down directions?
			const edges = [
				edge("A.md", "Parent.md", "up"),
				edge("B.md", "Parent.md", "up"),
				edge("Parent.md", "A.md", "down"),
				edge("Parent.md", "B.md", "down")
			];
			const relations = [
				relation("up", [{targetRelation: "sibling", direction: "sibling"}]),
				relation("down", [{targetRelation: "sibling", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			// 4 original + 2 sibling edges (should not duplicate from both rules)
			expect(result).toHaveLength(6);
			
			// Should have exactly one edge in each direction
			const abEdges = result.filter(
				(e) => e.fromPath === "A.md" && e.toPath === "B.md" && e.relation === "sibling"
			);
			const baEdges = result.filter(
				(e) => e.fromPath === "B.md" && e.toPath === "A.md" && e.relation === "sibling"
			);
			expect(abEdges).toHaveLength(1);
			expect(baEdges).toHaveLength(1);
		});
	});

	describe("sibling direction (nested/chained)", () => {
		it("should handle nested hierarchy with sibling implications", () => {
			// Grandparent -> Parent1, Parent2
			// Parent1 -> Child1A, Child1B
			// Parent2 -> Child2A
			const edges = [
				edge("Grandparent.md", "Parent1.md", "down"),
				edge("Grandparent.md", "Parent2.md", "down"),
				edge("Parent1.md", "Child1A.md", "down"),
				edge("Parent1.md", "Child1B.md", "down"),
				edge("Parent2.md", "Child2A.md", "down")
			];
			const relations = [
				relation("down", [{targetRelation: "sibling", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			// 5 original edges
			// + 2 sibling edges for Parent1/Parent2 (from Grandparent)
			// + 2 sibling edges for Child1A/Child1B (from Parent1)
			// Child2A has no siblings
			expect(result).toHaveLength(9);

			// Parents are siblings
			expect(hasEdge(result, "Parent1.md", "Parent2.md", "sibling")).toBe(true);
			expect(hasEdge(result, "Parent2.md", "Parent1.md", "sibling")).toBe(true);

			// Parent1's children are siblings
			expect(hasEdge(result, "Child1A.md", "Child1B.md", "sibling")).toBe(true);
			expect(hasEdge(result, "Child1B.md", "Child1A.md", "sibling")).toBe(true);

			// Children from different parents are NOT siblings
			expect(hasEdge(result, "Child1A.md", "Child2A.md", "sibling")).toBe(false);
		});
	});

	describe("regression: issue #9 - sibling implication for down relations", () => {
		/**
		 * Issue #9: Sibling implication doesn't work for relations
		 * https://github.com/theoryzhenkov/trail/issues/9
		 *
		 * Problem: When a file has `down: [B, C]` and `down` is configured to imply
		 * `same` between siblings, B and C should automatically have a `same` relation.
		 * This didn't work because the original implementation only looked for edges
		 * sharing the same TARGET (up-style), not edges sharing the same SOURCE (down-style).
		 */

		it("should create sibling relations for down: [B, C] scenario (issue #9)", () => {
			// Exact scenario from the issue:
			// File A has `down: [B, C]`
			// `down` is configured to imply `same` between siblings
			// B and C should have `same` relation between them
			const edges = [
				edge("A.md", "B.md", "down"),
				edge("A.md", "C.md", "down")
			];
			const relations = [
				relation("down", [{targetRelation: "same", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			// Must have the implied sibling relations
			expect(hasEdge(result, "B.md", "C.md", "same")).toBe(true);
			expect(hasEdge(result, "C.md", "B.md", "same")).toBe(true);

			// Verify they're marked as implied from "down"
			const bcEdge = result.find(
				(e) => e.fromPath === "B.md" && e.toPath === "C.md" && e.relation === "same"
			);
			expect(bcEdge?.implied).toBe(true);
			expect(bcEdge?.impliedFrom).toBe("down");
		});

		it("should work with real-world frontmatter array pattern", () => {
			// Real usage: frontmatter like `down: [Child1, Child2, Child3]`
			// creates multiple edges from same parent
			const edges = [
				edge("Parent.md", "Child1.md", "down"),
				edge("Parent.md", "Child2.md", "down"),
				edge("Parent.md", "Child3.md", "down")
			];
			const relations = [
				relation("down", [{targetRelation: "sibling", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			// All children should be siblings of each other
			// 3 original + 6 sibling (3 pairs, bidirectional)
			expect(result).toHaveLength(9);

			// Every pair should have bidirectional sibling relation
			expect(hasEdge(result, "Child1.md", "Child2.md", "sibling")).toBe(true);
			expect(hasEdge(result, "Child2.md", "Child1.md", "sibling")).toBe(true);
			expect(hasEdge(result, "Child1.md", "Child3.md", "sibling")).toBe(true);
			expect(hasEdge(result, "Child3.md", "Child1.md", "sibling")).toBe(true);
			expect(hasEdge(result, "Child2.md", "Child3.md", "sibling")).toBe(true);
			expect(hasEdge(result, "Child3.md", "Child2.md", "sibling")).toBe(true);
		});

		it("should be queryable - implied siblings appear in edge results", () => {
			// Ensure implied edges are included in output and usable
			const edges = [
				edge("Parent.md", "A.md", "down"),
				edge("Parent.md", "B.md", "down")
			];
			const relations = [
				relation("down", [{targetRelation: "same", direction: "sibling"}])
			];
			const result = applyImpliedRules(edges, relations);

			// Filter to only "same" relations - should find the implied ones
			const sameEdges = result.filter((e) => e.relation === "same");
			expect(sameEdges).toHaveLength(2);

			// Both directions present
			expect(sameEdges.some((e) => e.fromPath === "A.md" && e.toPath === "B.md")).toBe(
				true
			);
			expect(sameEdges.some((e) => e.fromPath === "B.md" && e.toPath === "A.md")).toBe(
				true
			);
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
