/**
 * Composable Filters for Traversal
 *
 * Filters determine which nodes to include and traverse during graph traversal.
 * They are composed by the executor from query clauses (PRUNE, WHERE, etc.)
 * into a single filter that the traversal uses.
 */

import type {NodeFilter, FilterDecision, NodeContext} from "./types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";

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
export function createPruneFilter(expr: ExprNode, ctx: ExecutorContext): NodeFilter {
	return {
		evaluate(nodeCtx: NodeContext): FilterDecision {
			ctx.setCurrentFile(nodeCtx.path, nodeCtx.properties);
			ctx.setTraversal(nodeCtx.traversalCtx);

			const result = expr.evaluate(ctx);
			const shouldPrune = ctx.isTruthy(result);

			if (shouldPrune) {
				return {include: false, traverse: false};
			}
			return {include: true, traverse: true};
		},
	};
}

// =============================================================================
// Where Filter (for future integration with traversal)
// =============================================================================

/**
 * Create a WHERE filter from an expression
 *
 * WHERE semantics: if expression evaluates to falsy, exclude node but still traverse children.
 * This maintains graph structure for ancestor paths.
 * - include: false (don't include in output)
 * - traverse: true (still visit children)
 *
 * Note: Currently WHERE is applied post-traversal in query-executor.ts.
 * This filter is provided for future integration where WHERE could be applied
 * during traversal for better performance.
 */
export function createWhereFilter(expr: ExprNode, ctx: ExecutorContext): NodeFilter {
	return {
		evaluate(nodeCtx: NodeContext): FilterDecision {
			ctx.setCurrentFile(nodeCtx.path, nodeCtx.properties);
			ctx.setTraversal(nodeCtx.traversalCtx);

			const result = expr.evaluate(ctx);
			const shouldInclude = ctx.isTruthy(result);

			return {
				include: shouldInclude,
				traverse: true, // Always traverse children for WHERE
			};
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
	/** WHERE expression (filter output, keep structure) - for future use */
	whereExpr?: ExprNode;
}

/**
 * Build a composed filter from query clauses
 *
 * The executor calls this to create a single filter from all applicable clauses.
 */
export function buildFilter(ctx: ExecutorContext, options: FilterBuildOptions): NodeFilter {
	const filters: NodeFilter[] = [];

	if (options.pruneExpr) {
		filters.push(createPruneFilter(options.pruneExpr, ctx));
	}

	// Note: WHERE is currently applied post-traversal to maintain ancestor paths.
	// Uncomment below if integrating WHERE into traversal:
	// if (options.whereExpr) {
	//   filters.push(createWhereFilter(options.whereExpr, ctx));
	// }

	return combineFilters(...filters);
}
