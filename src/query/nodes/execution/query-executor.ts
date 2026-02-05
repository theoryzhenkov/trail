/**
 * Query Executor - Shared execution logic for queries and inline queries
 *
 * This module provides the core execution logic that both QueryNode and
 * InlineQueryNode can use, avoiding code duplication and enabling full
 * recursive functionality.
 */

import type {QueryResultNode} from "../types";
import type {QueryEnv} from "../context";
import {evalContextFromNode} from "../context";
import type {FromNode} from "../clauses/FromNode";
import type {SortNode} from "../clauses/SortNode";
import type {PruneNode} from "../clauses/PruneNode";
import type {WhereNode} from "../clauses/WhereNode";
import {
	traverse,
	buildFilter,
	createChainHandler,
	createGroupResolver,
	type TraversalConfig,
} from "./traversal";
import {sortNodes} from "./sorting";

/**
 * Options for executing query clauses
 */
export interface ExecuteQueryOptions {
	/** The FROM clause specifying relations to traverse */
	from: FromNode;
	/** Optional PRUNE clause to limit traversal */
	prune?: PruneNode;
	/** Optional WHERE clause to filter results */
	where?: WhereNode;
	/** Optional SORT clause to order results */
	sort?: SortNode;
	/** Starting path for traversal (defaults to env.activeFilePath) */
	startPath?: string;
}

/**
 * Execute query clauses and return result nodes.
 *
 * This is the core execution logic shared by QueryNode and InlineQueryNode.
 * It performs traversal, filtering, and sorting but NOT display processing
 * (which is QueryNode-specific).
 */
export function executeQueryClauses(
	env: QueryEnv,
	options: ExecuteQueryOptions
): QueryResultNode[] {
	const {from, prune, where, sort, startPath} = options;

	// Traverse FROM clause
	const results = traverseFrom(env, from, prune, startPath ?? env.activeFilePath);

	// Apply WHERE filter (post-traversal to maintain ancestor paths)
	const filtered = where ? applyWhereFilter(results, where, env) : results;

	// Sort results
	const sorted = sort ? sortNodes(filtered, sort.keys, env) : filtered;

	return sorted;
}

/**
 * Traverse the FROM clause and return result nodes
 */
function traverseFrom(
	env: QueryEnv,
	from: FromNode,
	prune: PruneNode | undefined,
	startPath: string
): QueryResultNode[] {
	const results: QueryResultNode[] = [];

	// Build filter from PRUNE clause
	const filter = buildFilter(env, {
		pruneExpr: prune?.expression,
	});

	// Build group resolver
	const resolveGroup = createGroupResolver(env, filter);

	// Traverse each chain in the FROM clause
	for (const relationChain of from.chains) {
		const hasChain = relationChain.chain.length > 0;

		const config: TraversalConfig = {
			startPath,
			relation: relationChain.first.name,
			maxDepth: relationChain.first.depth === "unlimited" ? Infinity : relationChain.first.depth,
			filter,
			output: {
				flattenFrom: relationChain.first.flatten,
			},
			onLeaf: hasChain
				? createChainHandler(env, {
						chain: relationChain.chain,
						filter,
						resolveGroup,
				  })
				: undefined,
		};

		const result = traverse(env, config);
		results.push(...result.nodes);

		// Add warnings from traversal
		for (const warning of result.warnings) {
			env.addWarning(warning.message);
		}
	}

	return results;
}

/**
 * Apply WHERE filter to result nodes recursively
 *
 * WHERE is applied post-traversal to maintain ancestor paths.
 * Nodes that don't match are removed, but their children are
 * promoted to maintain graph connectivity.
 */
function applyWhereFilter(
	nodes: QueryResultNode[],
	where: WhereNode,
	env: QueryEnv
): QueryResultNode[] {
	const result: QueryResultNode[] = [];

	for (const node of nodes) {
		const nodeCtx = evalContextFromNode(env, node);
		const filteredChildren = applyWhereFilter(node.children, where, env);

		if (where.test(nodeCtx)) {
			result.push({...node, children: filteredChildren});
		} else if (filteredChildren.length > 0) {
			result.push(...filteredChildren.map((child) => ({...child, hasFilteredAncestor: true})));
		}
	}

	return result;
}
