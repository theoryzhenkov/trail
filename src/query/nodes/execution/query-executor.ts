/**
 * Query Executor - Shared execution logic for queries and inline queries
 *
 * This module provides the core execution logic that both QueryNode and
 * InlineQueryNode can use, avoiding code duplication and enabling full
 * recursive functionality.
 */

import type {QueryResultNode} from "../types";
import type {ExecutorContext} from "../context";
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
	/** Starting path for traversal (defaults to ctx.filePath) */
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
	ctx: ExecutorContext,
	options: ExecuteQueryOptions
): QueryResultNode[] {
	const {from, prune, where, sort, startPath} = options;

	// Traverse FROM clause
	const results = traverseFrom(ctx, from, prune, startPath ?? ctx.filePath);

	// Apply WHERE filter (post-traversal to maintain ancestor paths)
	const filtered = where ? applyWhereFilter(results, where, ctx) : results;

	// Sort results
	const sorted = sort ? sortNodes(filtered, sort.keys, ctx) : filtered;

	return sorted;
}

/**
 * Traverse the FROM clause and return result nodes
 */
function traverseFrom(
	ctx: ExecutorContext,
	from: FromNode,
	prune: PruneNode | undefined,
	startPath: string
): QueryResultNode[] {
	const results: QueryResultNode[] = [];

	// Build filter from PRUNE clause
	const filter = buildFilter(ctx, {
		pruneExpr: prune?.expression,
	});

	// Build group resolver
	const resolveGroup = createGroupResolver(ctx, filter);

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
				? createChainHandler(ctx, {
						chain: relationChain.chain,
						filter,
						resolveGroup,
				  })
				: undefined,
		};

		const result = traverse(ctx, config);
		results.push(...result.nodes);

		// Add warnings from traversal
		for (const warning of result.warnings) {
			ctx.addWarning(warning.message);
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
	ctx: ExecutorContext
): QueryResultNode[] {
	const result: QueryResultNode[] = [];

	for (const node of nodes) {
		ctx.setCurrentFile(node.path, node.properties);
		ctx.setTraversal({
			depth: node.depth,
			relation: node.relation,
			isImplied: node.implied,
			parent: node.parent,
			path: node.traversalPath,
		});

		const filteredChildren = applyWhereFilter(node.children, where, ctx);

		if (where.test(ctx)) {
			result.push({...node, children: filteredChildren});
		} else if (filteredChildren.length > 0) {
			result.push(...filteredChildren.map((child) => ({...child, hasFilteredAncestor: true})));
		}
	}

	return result;
}
