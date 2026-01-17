/**
 * Visual Editor for Simple TQL Queries
 * 
 * Provides a form-based UI for editing simple TQL queries.
 * Complex queries that cannot be represented visually fall back to the query editor.
 */

import type {Query, Expr, SortKey, PropertyAccess} from "../query/ast";
import {parse} from "../query";

/**
 * Visual representation of a simple query
 */
export interface VisualQuery {
	name: string;
	relations: VisualRelation[];
	where?: VisualCondition;
	sort?: VisualSortKey;
	display?: string[];
}

export interface VisualRelation {
	name: string;
	depth: number | "unlimited";
}

export interface VisualCondition {
	property: string;
	operator: "=" | "!=" | "<" | ">" | "<=" | ">=" | "contains";
	value: string | number | boolean;
}

export interface VisualSortKey {
	property: string;
	direction: "asc" | "desc";
}

/**
 * Check if a TQL query can be represented visually
 */
export function isVisualEditable(query: string): boolean {
	try {
		const ast = parse(query);
		return canVisualizeQuery(ast);
	} catch {
		return false;
	}
}

/**
 * Check if an AST can be visualized
 */
function canVisualizeQuery(ast: Query): boolean {
	// Must have a group name
	if (!ast.group) return false;
	
	// Must have at least one relation
	if (ast.from.relations.length === 0) return false;
	
	// No PRUNE clause
	if (ast.prune) return false;
	
	// No WHEN clause
	if (ast.when) return false;
	
	// WHERE must be simple (single comparison or missing)
	if (ast.where && !isSimpleCondition(ast.where)) return false;
	
	// SORT must be simple (single key or missing)
	if (ast.sort && (ast.sort.length > 1 || ast.sort[0]?.key === "chain")) return false;
	
	// DISPLAY must be simple (no "all", just property list)
	if (ast.display?.all) return false;
	
	return true;
}

/**
 * Check if an expression is a simple comparison
 */
function isSimpleCondition(expr: Expr): boolean {
	if (expr.type !== "compare") return false;
	
	// Left must be a simple property access
	if (expr.left.type !== "property") return false;
	
	// Right must be a literal
	if (!["string", "number", "boolean"].includes(expr.right.type)) return false;
	
	return true;
}

/**
 * Parse a TQL query into a visual representation
 */
export function parseToVisual(query: string): VisualQuery | null {
	try {
		const ast = parse(query);
		if (!canVisualizeQuery(ast)) return null;
		
		return {
			name: ast.group,
			relations: ast.from.relations.map(r => ({
				name: r.name,
				depth: r.depth,
			})),
			where: parseWhereClause(ast.where),
			sort: parseSortClause(ast.sort),
			display: parseDisplayClause(ast.display),
		};
	} catch {
		return null;
	}
}

function parseWhereClause(expr?: Expr): VisualCondition | undefined {
	if (!expr || expr.type !== "compare") return undefined;
	if (expr.left.type !== "property") return undefined;
	
	const property = expr.left.path.join(".");
	let operator: VisualCondition["operator"] = "=";
	
	switch (expr.op) {
		case "=": operator = "="; break;
		case "!=": operator = "!="; break;
		case "<": operator = "<"; break;
		case ">": operator = ">"; break;
		case "<=": operator = "<="; break;
		case ">=": operator = ">="; break;
		default: return undefined;
	}
	
	let value: string | number | boolean;
	switch (expr.right.type) {
		case "string": value = expr.right.value; break;
		case "number": value = expr.right.value; break;
		case "boolean": value = expr.right.value; break;
		default: return undefined;
	}
	
	return {property, operator, value};
}

function parseSortClause(sort?: SortKey[]): VisualSortKey | undefined {
	if (!sort || sort.length === 0) return undefined;
	const key = sort[0];
	if (!key || key.key === "chain") return undefined;
	
	return {
		property: (key.key as PropertyAccess).path.join("."),
		direction: key.direction,
	};
}

function parseDisplayClause(display?: Query["display"]): string[] | undefined {
	if (!display || display.all) return undefined;
	if (display.properties.length === 0) return undefined;
	
	return display.properties.map(p => p.path.join("."));
}

/**
 * Generate TQL from a visual representation
 */
export function visualToQuery(visual: VisualQuery): string {
	const lines: string[] = [];
	
	// GROUP clause
	lines.push(`group "${visual.name}"`);
	
	// FROM clause
	const relations = visual.relations.map(r => {
		const depth = r.depth === "unlimited" ? "unlimited" : r.depth.toString();
		return `${r.name} depth ${depth}`;
	}).join(", ");
	lines.push(`from ${relations}`);
	
	// WHERE clause
	if (visual.where) {
		const {property, operator, value} = visual.where;
		const valueStr = typeof value === "string" ? `"${value}"` : String(value);
		lines.push(`where ${property} ${operator} ${valueStr}`);
	}
	
	// SORT clause
	if (visual.sort) {
		lines.push(`sort by ${visual.sort.property} ${visual.sort.direction}`);
	}
	
	// DISPLAY clause
	if (visual.display && visual.display.length > 0) {
		lines.push(`display ${visual.display.join(", ")}`);
	}
	
	return lines.join("\n");
}
