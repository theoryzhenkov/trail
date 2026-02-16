/**
 * Composable Filters for Traversal
 *
 * Filters determine which nodes to include and traverse during graph traversal.
 * They are composed by the executor from query clauses (PRUNE, WHERE, etc.)
 * into a single filter that the traversal uses.
 */

import type {NodeFilter, FilterDecision, NodeContext} from "./types";
import type {QueryEnv} from "../../context";
import {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {isTruthy} from "../../value-ops";

// =============================================================================
// Filter Combinators
// =============================================================================

/**
 * Combine multiple filters into one (AND logic)
 *
 * - include: true only if ALL filters return include: true
 * - traverse: true only if ALL filters return traverse: true
 */
export function combineFilters(...filters: NodeFilter[]): NodeFilter {
	if (filters.length === 0) {
		return {evaluate: () => ({include: true, traverse: true})};
	}
	if (filters.length === 1) {
		return filters[0]!;
	}

	return {
		evaluate(ctx: NodeContext): FilterDecision {
			let include = true;
			let traverse = true;

			for (const filter of filters) {
				const decision = filter.evaluate(ctx);
				include = include && decision.include;
				traverse = traverse && decision.traverse;

				// Early exit if both are false
				if (!include && !traverse) {
					break;
				}
			}

			return {include, traverse};
		},
	};
}

// =============================================================================
// Prune Filter
// =============================================================================

/**
 * Create a PRUNE filter from an expression
 *
 * PRUNE semantics: if expression evaluates to truthy, skip the node AND its subtree.
 * - include: false (don't include in output)
 * - traverse: false (don't visit children)
 */
export function createPruneFilter(expr: ExprNode, env: QueryEnv): NodeFilter {
	return {
		evaluate(nodeCtx: NodeContext): FilterDecision {
			const evalCtx = new EvalContext(env, nodeCtx.path, nodeCtx.properties, nodeCtx.traversalCtx);
			const result = expr.evaluate(evalCtx);
			const shouldPrune = isTruthy(result);

			if (shouldPrune) {
				return {include: false, traverse: false};
			}
			return {include: true, traverse: true};
		},
	};
}

// =============================================================================
// Filter Builder (used by executor)
// =============================================================================

/**
 * Options for building a composed filter
 */
export interface FilterBuildOptions {
	/** PRUNE expression (skip node and subtree) */
	pruneExpr?: ExprNode;
}

/**
 * Build a composed filter from query clauses
 *
 * The executor calls this to create a single filter from all applicable clauses.
 */
export function buildFilter(env: QueryEnv, options: FilterBuildOptions): NodeFilter {
	const filters: NodeFilter[] = [];

	if (options.pruneExpr) {
		filters.push(createPruneFilter(options.pruneExpr, env));
	}

	return combineFilters(...filters);
}
