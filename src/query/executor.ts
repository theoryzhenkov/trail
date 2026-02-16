/**
 * TQL Executor - Entry point for query execution
 *
 * This module provides a thin wrapper that creates the query environment
 * and delegates to Query.execute().
 */

import {Query} from "./nodes/query";
import {QueryEnv} from "./nodes/context";
import type {QueryContext, QueryResult} from "./nodes/types";

/**
 * Execute a validated TQL query
 */
export function execute(query: Query, ctx: QueryContext): QueryResult {
	const env = new QueryEnv(ctx);
	return query.execute(env);
}
