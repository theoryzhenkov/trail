/**
 * TQL Executor - Entry point for query execution
 * 
 * This module provides a thin wrapper that creates the query environment
 * and delegates to QueryNode.execute().
 */

import {QueryNode} from "./nodes/clauses";
import {QueryEnv} from "./nodes/context";
import type {QueryContext, QueryResult} from "./nodes/types";

/**
 * Execute a validated TQL query
 */
export function execute(query: QueryNode, ctx: QueryContext): QueryResult {
	const env = new QueryEnv(ctx);
	return query.execute(env);
}
