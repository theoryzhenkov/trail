/**
 * TQL Public API
 *
 * This module provides the main entry points for parsing, validating,
 * and executing TQL queries.
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

// Re-export main functions
export {tokenize, Lexer, LexerError} from "./lexer";
export {parse, Parser} from "./parser";
export {validate, Validator, createValidationContext} from "./validator";
export {execute} from "./executor";

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
