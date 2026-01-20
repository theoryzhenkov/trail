/**
 * TQL Node System - Main Entry Point
 * 
 * This module provides the class-based node architecture for TQL.
 * Import this to get access to all node types and the TQL pipeline API.
 */

// Types
export * from "./types";

// Context
export {ExecutorContext, ValidationContextImpl, createValidationContext} from "./context";

// Registry
export {register, registry, getNodeClass, getTokenClass, getAllTokenClasses, isTokenKeyword} from "./registry";

// Base classes
export * from "./base";

// Tokens
export * from "./tokens";

// Expressions
export * from "./expressions";

// Literals
export * from "./literals";

// Functions - import to register all functions
import "./functions";

// Clauses
export * from "./clauses";

// Parser
export {parse, ParseError} from "./parser";

// ============================================================================
// TQL Pipeline API
// ============================================================================

import type {QueryContext, QueryResult} from "./types";
import {QueryNode} from "./clauses/QueryNode";
import {ExecutorContext, createValidationContext} from "./context";
import {parse} from "./parser";

/**
 * TQL Pipeline API
 * 
 * Usage:
 *   const result = TQL.parse(input).validate(ctx).execute(ctx);
 * 
 * Or for quick execution:
 *   const result = TQL.run(input, queryCtx);
 */
export const TQL = {
	/**
	 * Parse a TQL query string into a QueryNode
	 */
	parse(input: string): QueryNode {
		return parse(input);
	},

	/**
	 * Full pipeline: parse, validate, and execute
	 */
	run(
		input: string,
		queryCtx: QueryContext,
		relationNames: string[],
		groupNames: string[]
	): QueryResult {
		const query = this.parse(input);
		const validationCtx = createValidationContext(relationNames, groupNames);
		query.validate(validationCtx);
		
		const executorCtx = new ExecutorContext(queryCtx);
		return query.execute(executorCtx);
	},
};

/**
 * Empty result helper
 */
export function emptyResult(visible = true): QueryResult {
	return {
		visible,
		results: [],
		warnings: [],
	};
}
