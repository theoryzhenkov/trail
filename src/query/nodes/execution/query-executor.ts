/**
 * Query Executor - Shared execution logic for queries and inline queries
 *
 * This module provides the core execution logic that both QueryNode and
 * InlineQueryNode can use, avoiding code duplication and enabling full
 * recursive functionality.
 */

import type {QueryResultNode} from "../types";
import type {ExecutorContext} from "../context";
import type {FromNode, ChainTarget} from "../clauses/FromNode";
import type {SortNode} from "../clauses/SortNode";
import type {PruneNode} from "../clauses/PruneNode";
import type {WhereNode} from "../clauses/WhereNode";
import {traverse, type TraversalOptions} from "./traversal";
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

	// Apply WHERE filter
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

	// Extract prune expression for traversal
	const pruneExpr = prune?.expression;

	// Build group resolver for backwards compatibility with extendGroup
	const resolveGroup = (name: string): TraversalOptions[] | undefined => {
		const groupQuery = ctx.resolveGroupQuery(name) as
			| {from: FromNode}
			| undefined;
		if (!groupQuery) return undefined;

		// Convert the group's chains to TraversalOptions[]
		const options: TraversalOptions[] = [];
		for (const chain of groupQuery.from.chains) {
			options.push({
				startPath: "",
				relation: chain.first.name,
				maxDepth: chain.first.depth === "unlimited" ? Infinity : chain.first.depth,
				flatten: chain.first.flatten,
				pruneExpr,
				chain: chain.chain.length > 0 ? chain.chain : undefined,
				resolveGroup,
			});
		}
		return options.length > 0 ? options : undefined;
	};

	// Traverse each chain in the FROM clause
	for (const relationChain of from.chains) {
		const traversalOptions: TraversalOptions = {
			startPath,
			relation: relationChain.first.name,
			maxDepth: relationChain.first.depth === "unlimited" ? Infinity : relationChain.first.depth,
			flatten: relationChain.first.flatten,
			pruneExpr,
			chain: relationChain.chain.length > 0 ? relationChain.chain : undefined,
			resolveGroup,
		};

		const result = traverse(ctx, traversalOptions);
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
