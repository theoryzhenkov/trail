/**
 * TQL Public API
 *
 * This module provides the main entry points for parsing, validating,
 * and executing TQL queries.
 * 
 * Two APIs are available:
 * - Legacy API: parse(), validate(), execute() - uses plain AST objects
 * - New API: TQL namespace with class-based nodes
 */

// Re-export types
export type {
	Query,
	FromClause,
	RelationSpec,
	SortKey,
	DisplayClause,
	Expr,
	PropertyAccess,
	FunctionCall,
	Literal,
	Value,
	Span,
} from "./ast";

export type {Token, TokenType} from "./tokens";

export type {ValidatedQuery, ValidationContext} from "./validator";

export type {QueryContext} from "./context";

export type {QueryResult, QueryResultNode, QueryWarning} from "./result";

export type {BuiltinFunction, FunctionContext, FileMetadata} from "./builtins";

// Re-export errors
export {TQLError, ParseError, ValidationError, RuntimeError, ValidationErrors} from "./errors";
export type {ValidationErrorCode} from "./errors";

// Re-export main functions (legacy API)
export {tokenize, Lexer, LexerError} from "./lexer";
export {parse, Parser} from "./parser";
export {validate, Validator, createValidationContext} from "./validator";
export {execute} from "./executor";

// ============================================================================
// New Node-based API
// ============================================================================

// Export the new TQL namespace with class-based nodes
export {TQL} from "./nodes";

// Export new parser/lexer (for direct use)
export {
	parse as parseNodes,
	Parser as NodeParser,
	ParseError as NodeParseError,
	tokenize as tokenizeNodes,
	Lexer as NodeLexer,
	LexerError as NodeLexerError,
} from "./nodes";

// Export node types for type checking
export type {
	NodeDoc,
	Span as NodeSpan,
	Value as NodeValue,
	QueryResult as NodeQueryResult,
} from "./nodes/types";

// Export node classes
export {
	QueryNode,
	FromNode,
	RelationSpecNode,
	SortNode,
	SortKeyNode,
	DisplayNode,
} from "./nodes/clauses";

export {
	LogicalNode,
	CompareNode,
	ArithNode,
	UnaryNotNode,
	InNode,
	RangeNode,
	PropertyNode,
	CallNode,
	AggregateNode,
	DateExprNode,
} from "./nodes/expressions";

export {
	StringNode,
	NumberNode,
	BooleanNode,
	NullNode,
	DurationNode,
	DateLiteralNode,
	RelativeDateNode,
} from "./nodes/literals";

// Re-export utilities
export {emptyResult} from "./result";
export {propertiesToValues} from "./context";
export {getBuiltin, isBuiltin, getBuiltinNames, callBuiltin} from "./builtins";
export {QueryCache, getCache, resetCache} from "./cache";

// Type guards
export {
	isLogicalExpr,
	isCompareExpr,
	isArithExpr,
	isUnaryExpr,
	isInExpr,
	isRangeExpr,
	isFunctionCall,
	isPropertyAccess,
	isDateExpr,
	isLiteral,
	isStringLiteral,
	isNumberLiteral,
	isBooleanLiteral,
	isNullLiteral,
	isDurationLiteral,
} from "./ast";

/**
 * Parse and validate a TQL query in one step
 */
import {parse as parseQuery} from "./parser";
import {validate as validateQuery, ValidationContext} from "./validator";
import {execute as executeQuery} from "./executor";
import type {Query} from "./ast";
import type {QueryContext} from "./context";
import type {QueryResult} from "./result";

/**
 * Parse a TQL query string into an AST
 */
export function parseAndValidate(input: string, ctx: ValidationContext): Query {
	const ast = parseQuery(input);
	return validateQuery(ast, ctx);
}

/**
 * Full pipeline: parse, validate, and execute a TQL query
 */
export function run(
	input: string,
	validationCtx: ValidationContext,
	queryCtx: QueryContext
): QueryResult {
	const ast = parseQuery(input);
	const validated = validateQuery(ast, validationCtx);
	return executeQuery(validated, queryCtx);
}
