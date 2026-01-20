/**
 * TQL Executor - Entry point for query execution
 * 
 * This module provides a thin wrapper that creates the execution context
 * and delegates to QueryNode.execute().
 */

import {QueryNode} from "./nodes/clauses";
import {ExecutorContext} from "./nodes/context";
import type {QueryContext, QueryResult} from "./nodes/types";

/**
 * Execute a validated TQL query
 */
export function execute(query: QueryNode, ctx: QueryContext): QueryResult {
	const executorCtx = new ExecutorContext(ctx);
	return query.execute(executorCtx);
}
