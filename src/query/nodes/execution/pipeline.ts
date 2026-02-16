/**
 * Pipeline Architecture for TQL Query Execution
 *
 * Defines the interfaces for a composable query pipeline:
 *   AST nodes → Query (plain class) → Pipeline → Result
 *
 * All post-traversal clauses implement QueryTransform, making them
 * structurally consistent and composable.
 */

import type {QueryEnv} from "../context";
import type {QueryResultNode} from "../types";

// =============================================================================
// Pipeline Interfaces
// =============================================================================

/**
 * Guards decide whether a query should execute at all.
 * Used by WHEN clause to conditionally hide groups.
 */
export interface QueryGuard {
	shouldExecute(env: QueryEnv): boolean;
}

/**
 * Sources produce the initial set of result nodes.
 * Used by FROM clause + traversal to walk the graph.
 */
export interface QuerySource {
	produce(env: QueryEnv, startPath: string): QueryResultNode[];
}

/**
 * Transforms modify result nodes after traversal.
 * Used by WHERE, SORT, DISPLAY, and future post-traversal clauses.
 */
export interface QueryTransform {
	apply(nodes: QueryResultNode[], env: QueryEnv): QueryResultNode[];
}

/**
 * A fully assembled query pipeline.
 */
export interface QueryPipeline {
	guard?: QueryGuard;
	source: QuerySource;
	transforms: QueryTransform[];
}

// =============================================================================
// Pipeline Execution
// =============================================================================

/**
 * Execute a compiled pipeline: guard → source → transforms.
 *
 * Returns null if the guard prevents execution (query should be hidden).
 */
export function executePipeline(
	pipeline: QueryPipeline,
	env: QueryEnv,
	startPath: string
): QueryResultNode[] | null {
	if (pipeline.guard && !pipeline.guard.shouldExecute(env)) {
		return null;
	}

	let nodes = pipeline.source.produce(env, startPath);

	for (const transform of pipeline.transforms) {
		nodes = transform.apply(nodes, env);
	}

	return nodes;
}
