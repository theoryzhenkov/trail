/**
 * TQL Validator - Validates parsed AST against context
 */

import type {
	Query,
	Expr,
	PropertyAccess,
	FunctionCall,
	RelationSpec,
	SortKey,
	DisplayClause,
} from "./ast";
import type {Span} from "./tokens";
import {ValidationError, ValidationErrors} from "./errors";
import {getBuiltin} from "./builtins";

/**
 * Validation context providing access to known relations and groups
 */
export interface ValidationContext {
	/** Get known relation names */
	getRelationNames(): string[];
	/** Get known group names */
	getGroupNames(): string[];
	/** Check if a relation exists */
	hasRelation(name: string): boolean;
	/** Check if a group exists */
	hasGroup(name: string): boolean;
}

/**
 * Validated query - same structure as Query but guaranteed valid
 */
export type ValidatedQuery = Query;

/**
 * Validator class that collects all errors
 */
export class Validator {
	private errors: ValidationError[] = [];
	private ctx: ValidationContext;

	constructor(ctx: ValidationContext) {
		this.ctx = ctx;
	}

	validate(query: Query): ValidatedQuery {
		this.errors = [];

		// Validate FROM clause
		this.validateFromClause(query.from.relations);

		// Validate expressions
		if (query.prune) {
			this.validateExpr(query.prune);
		}
		if (query.where) {
			this.validateExpr(query.where);
		}
		if (query.when) {
			this.validateExpr(query.when);
		}

		// Validate SORT clause
		if (query.sort) {
			this.validateSortClause(query.sort);
		}

		// Validate DISPLAY clause
		if (query.display) {
			this.validateDisplayClause(query.display);
		}

		if (this.errors.length > 0) {
			throw new ValidationErrors(this.errors);
		}

		return query;
	}

	private validateFromClause(relations: RelationSpec[]): void {
		for (const rel of relations) {
			// Check relation exists
			if (!this.ctx.hasRelation(rel.name)) {
				this.addError(
					`Unknown relation: ${rel.name}`,
					rel.span,
					"UNKNOWN_RELATION"
				);
			}

			// Check extend group exists
			if (rel.extend && !this.ctx.hasGroup(rel.extend)) {
				this.addError(
					`Unknown group for extend: ${rel.extend}`,
					rel.span,
					"UNKNOWN_GROUP"
				);
			}
		}
	}

	private validateExpr(expr: Expr): void {
		switch (expr.type) {
			case "logical":
				this.validateExpr(expr.left);
				this.validateExpr(expr.right);
				break;

			case "compare":
				this.validateExpr(expr.left);
				this.validateExpr(expr.right);
				break;

			case "arith":
				this.validateExpr(expr.left);
				this.validateExpr(expr.right);
				break;

			case "unary":
				this.validateExpr(expr.operand);
				break;

			case "in":
				this.validateExpr(expr.value);
				this.validateExpr(expr.collection);
				break;

			case "range":
				this.validateExpr(expr.value);
				this.validateExpr(expr.lower);
				this.validateExpr(expr.upper);
				break;

			case "call":
				this.validateFunctionCall(expr);
				break;

			case "property":
				this.validatePropertyAccess(expr);
				break;

			case "dateExpr":
				if (expr.base.type === "property") {
					this.validatePropertyAccess(expr.base);
				}
				break;

			// Literals don't need validation
			case "string":
			case "number":
			case "boolean":
			case "null":
			case "duration":
				break;
		}
	}

	private validateFunctionCall(call: FunctionCall): void {
		const fn = getBuiltin(call.name);

		if (!fn) {
			this.addError(
				`Unknown function: ${call.name}`,
				call.span,
				"UNKNOWN_FUNCTION"
			);
			// Still validate arguments
			for (const arg of call.args) {
				this.validateExpr(arg);
			}
			return;
		}

		// Check arity
		if (call.args.length < fn.minArity) {
			this.addError(
				`${call.name}() requires at least ${fn.minArity} argument(s), got ${call.args.length}`,
				call.span,
				"INVALID_ARITY"
			);
		} else if (call.args.length > fn.maxArity) {
			this.addError(
				`${call.name}() accepts at most ${fn.maxArity} argument(s), got ${call.args.length}`,
				call.span,
				"INVALID_ARITY"
			);
		}

		// Validate arguments
		for (const arg of call.args) {
			this.validateExpr(arg);
		}
	}

	private validatePropertyAccess(prop: PropertyAccess): void {
		// Property access is generally valid - we can't know all possible
		// properties at validation time since they come from file frontmatter
		// Just ensure path is not empty
		if (prop.path.length === 0) {
			this.addError(
				"Empty property path",
				prop.span,
				"TYPE_MISMATCH"
			);
		}
	}

	private validateSortClause(keys: SortKey[]): void {
		for (const key of keys) {
			if (key.key !== "chain" && key.key.type === "property") {
				this.validatePropertyAccess(key.key);
			}
		}
	}

	private validateDisplayClause(display: DisplayClause): void {
		for (const prop of display.properties) {
			this.validatePropertyAccess(prop);
		}
	}

	private addError(
		message: string,
		span: Span,
		code: ValidationError["code"]
	): void {
		this.errors.push(new ValidationError(message, span, code));
	}
}

/**
 * Validate a parsed query against a context
 */
export function validate(query: Query, ctx: ValidationContext): ValidatedQuery {
	const validator = new Validator(ctx);
	return validator.validate(query);
}

/**
 * Create a simple validation context from arrays of names
 */
export function createValidationContext(
	relationNames: string[],
	groupNames: string[]
): ValidationContext {
	const relations = new Set(relationNames);
	const groups = new Set(groupNames);

	return {
		getRelationNames: () => relationNames,
		getGroupNames: () => groupNames,
		hasRelation: (name) => relations.has(name),
		hasGroup: (name) => groups.has(name),
	};
}
