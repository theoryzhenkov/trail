/**
 * TQL Abstract Syntax Tree Types
 * Based on TQL Specification Section 8
 */

import type {Span} from "./tokens";

// Re-export Span for convenience
export type {Span} from "./tokens";

/**
 * Top-level Query structure
 */
export interface Query {
	type: "query";
	group: string;
	from: FromClause;
	prune?: Expr;
	where?: Expr;
	when?: Expr;
	sort?: SortKey[];
	display?: DisplayClause;
	span: Span;
}

/**
 * FROM clause with relation specifications
 */
export interface FromClause {
	type: "from";
	relations: RelationSpec[];
	span: Span;
}

/**
 * Individual relation specification within FROM
 */
export interface RelationSpec {
	type: "relationSpec";
	name: string;
	depth: number | "unlimited";
	extend?: string;
	flatten?: boolean;
	span: Span;
}

/**
 * Sort key for ORDER BY
 */
export interface SortKey {
	type: "sortKey";
	key: "chain" | PropertyAccess;
	direction: "asc" | "desc";
	span: Span;
}

/**
 * DISPLAY clause
 */
export interface DisplayClause {
	type: "display";
	all: boolean;
	properties: PropertyAccess[];
	span: Span;
}

// ============================================================================
// Expressions
// ============================================================================

export type Expr =
	| LogicalExpr
	| CompareExpr
	| ArithExpr
	| UnaryExpr
	| InExpr
	| RangeExpr
	| FunctionCall
	| PropertyAccess
	| DateExpr
	| AggregateExpr
	| Literal;

/**
 * Logical AND/OR expression
 */
export interface LogicalExpr {
	type: "logical";
	op: "and" | "or";
	left: Expr;
	right: Expr;
	span: Span;
}

/**
 * Comparison expression
 */
export interface CompareExpr {
	type: "compare";
	op: "=" | "!=" | "<" | ">" | "<=" | ">=" | "=?" | "!=?";
	left: Expr;
	right: Expr;
	span: Span;
}

/**
 * Arithmetic expression
 */
export interface ArithExpr {
	type: "arith";
	op: "+" | "-";
	left: Expr;
	right: Expr;
	span: Span;
}

/**
 * Unary NOT expression
 */
export interface UnaryExpr {
	type: "unary";
	op: "not";
	operand: Expr;
	span: Span;
}

/**
 * IN expression for membership/substring checks
 */
export interface InExpr {
	type: "in";
	value: Expr;
	collection: Expr;
	span: Span;
}

/**
 * Range expression (value in lower..upper)
 */
export interface RangeExpr {
	type: "range";
	value: Expr;
	lower: Expr;
	upper: Expr;
	span: Span;
}

/**
 * Function call expression
 */
export interface FunctionCall {
	type: "call";
	name: string;
	args: Expr[];
	span: Span;
}

/**
 * Property access expression
 */
export interface PropertyAccess {
	type: "property";
	path: string[];
	span: Span;
}

/**
 * Date expression with optional offset
 */
export interface DateExpr {
	type: "dateExpr";
	base: DateLiteral | RelativeDateLiteral | PropertyAccess;
	offset?: {op: "+" | "-"; duration: DurationLiteral};
	span: Span;
}

// ============================================================================
// Aggregate Expressions
// ============================================================================

/**
 * Aggregate function type
 */
export type AggregateFunc = "count" | "sum" | "avg" | "min" | "max" | "any" | "all";

/**
 * Aggregate expression - executes a subquery and computes a value over results
 */
export interface AggregateExpr {
	type: "aggregate";
	func: AggregateFunc;
	source: GroupRefExpr | InlineFrom | BareIdentifier;
	property?: PropertyAccess;  // For sum, avg, min, max
	condition?: Expr;           // For any, all
	span: Span;
}

/**
 * Explicit group reference via group("Name") syntax
 */
export interface GroupRefExpr {
	type: "groupRef";
	name: string;
	span: Span;
}

/**
 * Inline FROM clause for aggregate traversal
 */
export interface InlineFrom {
	type: "inlineFrom";
	relations: RelationSpec[];
	span: Span;
}

/**
 * Bare identifier - resolved to group or relation at validation time
 */
export interface BareIdentifier {
	type: "bareIdentifier";
	name: string;
	span: Span;
}

/**
 * Union type for aggregate source
 */
export type AggregateSource = GroupRefExpr | InlineFrom | BareIdentifier;

// ============================================================================
// Literals
// ============================================================================

export type Literal =
	| StringLiteral
	| NumberLiteral
	| BooleanLiteral
	| NullLiteral
	| DurationLiteral
	| DateLiteral;

export interface StringLiteral {
	type: "string";
	value: string;
	span: Span;
}

export interface NumberLiteral {
	type: "number";
	value: number;
	span: Span;
}

export interface BooleanLiteral {
	type: "boolean";
	value: boolean;
	span: Span;
}

export interface NullLiteral {
	type: "null";
	span: Span;
}

export interface DurationLiteral {
	type: "duration";
	value: number;
	unit: "d" | "w" | "m" | "y";
	span: Span;
}

/**
 * Date literal (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
 */
export interface DateLiteral {
	type: "date";
	value: Date;
	span: Span;
}

/**
 * Relative date literal
 */
export interface RelativeDateLiteral {
	type: "relativeDate";
	kind: "today" | "yesterday" | "tomorrow" | "startOfWeek" | "endOfWeek";
	span: Span;
}

// ============================================================================
// Runtime Values
// ============================================================================

/**
 * Runtime value type for expression evaluation
 */
export type Value = string | number | boolean | Date | null | Value[];

// ============================================================================
// Type Guards
// ============================================================================

export function isLogicalExpr(expr: Expr): expr is LogicalExpr {
	return expr.type === "logical";
}

export function isCompareExpr(expr: Expr): expr is CompareExpr {
	return expr.type === "compare";
}

export function isArithExpr(expr: Expr): expr is ArithExpr {
	return expr.type === "arith";
}

export function isUnaryExpr(expr: Expr): expr is UnaryExpr {
	return expr.type === "unary";
}

export function isInExpr(expr: Expr): expr is InExpr {
	return expr.type === "in";
}

export function isRangeExpr(expr: Expr): expr is RangeExpr {
	return expr.type === "range";
}

export function isFunctionCall(expr: Expr): expr is FunctionCall {
	return expr.type === "call";
}

export function isPropertyAccess(expr: Expr): expr is PropertyAccess {
	return expr.type === "property";
}

export function isDateExpr(expr: Expr): expr is DateExpr {
	return expr.type === "dateExpr";
}

export function isLiteral(expr: Expr): expr is Literal {
	return (
		expr.type === "string" ||
		expr.type === "number" ||
		expr.type === "boolean" ||
		expr.type === "null" ||
		expr.type === "duration" ||
		expr.type === "date"
	);
}

export function isDateLiteral(expr: Expr): expr is DateLiteral {
	return expr.type === "date";
}

export function isStringLiteral(expr: Expr): expr is StringLiteral {
	return expr.type === "string";
}

export function isNumberLiteral(expr: Expr): expr is NumberLiteral {
	return expr.type === "number";
}

export function isBooleanLiteral(expr: Expr): expr is BooleanLiteral {
	return expr.type === "boolean";
}

export function isNullLiteral(expr: Expr): expr is NullLiteral {
	return expr.type === "null";
}

export function isDurationLiteral(expr: Expr): expr is DurationLiteral {
	return expr.type === "duration";
}

export function isAggregateExpr(expr: Expr): expr is AggregateExpr {
	return expr.type === "aggregate";
}

export function isGroupRefExpr(source: AggregateSource): source is GroupRefExpr {
	return source.type === "groupRef";
}

export function isInlineFrom(source: AggregateSource): source is InlineFrom {
	return source.type === "inlineFrom";
}

export function isBareIdentifier(source: AggregateSource): source is BareIdentifier {
	return source.type === "bareIdentifier";
}
