/**
 * TQL Node System - Main Entry Point
 * 
 * This module provides the class-based node architecture for TQL.
 * Import this to get access to all node types and the TQL pipeline API.
 */

// Types
export * from "./types";

// Context
export {QueryEnv, EvalContext, evalContextFromNode, evalContextForActiveFile, ValidationContextImpl, createValidationContext} from "./context";

// Registry
export {register, registry, getNodeClass, getTokenClass, getAllTokenClasses, isTokenKeyword} from "./registry";

// Base classes
export * from "./base";

// Tokens
export * from "./tokens";

// Modifiers (metadata-only, for completion)
import "./modifiers";

// Expressions
export * from "./expressions";

// Literals
export * from "./literals";

// Functions
import "./functions";

// Clauses
export * from "./clauses";

// Query (non-Node compilation unit)
export {Query} from "./query";

// Parser
export {parse, ParseError} from "./parser";

import type {QueryContext, QueryResult} from "./types";
import {Query} from "./query";
import {QueryEnv, createValidationContext} from "./context";
import {parse} from "./parser";

/**
 * TQL Pipeline API
 *
 * Usage:
 *   const result = TQL.parse(input).validate(ctx).execute(env);
 *
 * Or for quick execution:
 *   const result = TQL.run(input, queryCtx);
 */
export const TQL = {
	/**
	 * Parse a TQL query string into a Query
	 */
	parse(input: string): Query {
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

		const env = new QueryEnv(queryCtx);
		return query.execute(env);
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
