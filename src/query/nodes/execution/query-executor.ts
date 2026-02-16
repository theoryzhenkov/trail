/**
 * Query Executor - Shared execution logic for queries and inline queries
 *
 * This module provides the core execution logic that both QueryNode and
 * InlineQueryNode can use, avoiding code duplication and enabling full
 * recursive functionality.
 *
 * Now implemented using the pipeline architecture internally.
 */

import type {QueryResultNode} from "../types";
import type {QueryEnv} from "../context";
import type {FromNode} from "../clauses/FromNode";
import type {SortNode} from "../clauses/SortNode";
import type {PruneNode} from "../clauses/PruneNode";
import type {WhereNode} from "../clauses/WhereNode";
import type {QueryTransform} from "./pipeline";
import {TraversalSource} from "./sources/traversal-source";
import {WhereTransform} from "./transforms/where-transform";
import {SortTransform} from "./transforms/sort-transform";
import {executePipeline} from "./pipeline";

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

	const source = new TraversalSource(from, prune);

	const transforms: QueryTransform[] = [];
	if (where) transforms.push(new WhereTransform(where));
	if (sort) transforms.push(new SortTransform(sort));

	const result = executePipeline({source, transforms}, env, startPath ?? env.activeFilePath);
	return result ?? [];
}
