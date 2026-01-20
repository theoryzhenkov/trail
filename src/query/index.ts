/**
 * TQL Public API
 *
 * This module provides the main entry points for parsing, validating,
 * and executing TQL queries using the node-based architecture.
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
	Span,
	Value,
	NodeDoc,
	QueryContext,
	QueryResult,
	QueryResultNode,
	QueryWarning,
	TraversalContext,
	FileMetadata,
	ValidationContext,
} from "./nodes/types";

// ============================================================================
// Parser & Lexer
// ============================================================================

export {parse, ParseError} from "./nodes/parser";

// ============================================================================
// Execution
// ============================================================================

export {execute} from "./executor";
export {ExecutorContext, createValidationContext} from "./nodes/context";

// ============================================================================
// Errors
// ============================================================================

export {TQLError, ValidationError, RuntimeError, ValidationErrors} from "./errors";
export type {ValidationErrorCode} from "./errors";

// ============================================================================
// Clause Nodes
// ============================================================================

export {
	QueryNode,
	FromNode,
	RelationSpecNode,
	SortNode,
	SortKeyNode,
	DisplayNode,
} from "./nodes/clauses";

// ============================================================================
// Expression Nodes
// ============================================================================

export {
	OrExprNode,
	AndExprNode,
	CompareExprNode,
	ArithExprNode,
	NotExprNode,
	InExprNode,
	RangeNode,
	PropertyNode,
	AggregateNode,
	DateExprNode,
} from "./nodes/expressions";

// ============================================================================
// Literal Nodes
// ============================================================================

export {
	StringNode,
	NumberNode,
	BooleanNode,
	NullNode,
	DurationNode,
	DateLiteralNode,
	RelativeDateNode,
} from "./nodes/literals";

// ============================================================================
// Base Classes (for extension)
// ============================================================================

export {Node} from "./nodes/base/Node";
export {ExprNode} from "./nodes/base/ExprNode";
export {ClauseNode} from "./nodes/base/ClauseNode";
export {TokenNode} from "./nodes/base/TokenNode";
export {LiteralNode} from "./nodes/base/LiteralNode";
export {BinaryNode} from "./nodes/base/BinaryNode";
export {UnaryNode} from "./nodes/base/UnaryNode";

// ============================================================================
// TQL Namespace (convenience re-export)
// ============================================================================

export {TQL} from "./nodes";

// ============================================================================
// Utilities
// ============================================================================

export {emptyResult} from "./nodes";
export {QueryCache, getCache, resetCache} from "./cache";

// ============================================================================
// Convenience Functions
// ============================================================================

import {parse as parseQuery} from "./nodes/parser";
import {execute as executeQuery} from "./executor";
import {createValidationContext as createValCtx} from "./nodes/context";
import type {QueryContext, QueryResult, ValidationContext as ValCtx} from "./nodes/types";

/**
 * Parse and validate a TQL query in one step
 */
export function parseAndValidate(input: string, ctx: ValCtx) {
	const query = parseQuery(input);
	query.validate(ctx);
	return query;
}

/**
 * Full pipeline: parse, validate, and execute a TQL query
 */
export function run(
	input: string,
	validationCtx: ValCtx,
	queryCtx: QueryContext
): QueryResult {
	const query = parseQuery(input);
	query.validate(validationCtx);
	return executeQuery(query, queryCtx);
}

/**
 * Create validation context from relation and group names
 */
export function createContext(relationNames: string[], groupNames: string[] = []) {
	return createValCtx(relationNames, groupNames);
}
