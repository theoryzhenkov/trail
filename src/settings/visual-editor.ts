/**
 * Visual Editor for Simple TQL Queries
 *
 * Provides a form-based UI for editing simple TQL queries.
 * Complex queries that cannot be represented visually fall back to the query editor.
 */

import {parse, QueryNode, CompareExprNode, PropertyNode, StringNode, NumberNode, BooleanNode, NullNode} from "../query";
import type {ExprNode} from "../query";

/**
 * Visual representation of a simple query
 */
export interface VisualQuery {
	name: string;
	relations: VisualRelation[];
	where?: VisualCondition;
	when?: VisualCondition;
	sort?: VisualSortKey;
	display?: string[];
}

export interface VisualRelation {
	name: string;
	depth: number | "unlimited";
}

export interface VisualCondition {
	property: string;
	operator: "=" | "!=" | "<" | ">" | "<=" | ">=" | "contains" | "exists" | "notExists";
	value?: string | number | boolean;
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
function canVisualizeQuery(ast: QueryNode): boolean {
	// Must have a group name
	if (!ast.group) return false;

	// Must have at least one relation
	if (ast.from.relations.length === 0) return false;

	// No PRUNE clause
	if (ast.prune) return false;

	// WHEN must be simple (single comparison or missing)
	if (ast.when && !isSimpleCondition(ast.when.expression)) return false;

	// WHERE must be simple (single comparison or missing)
	if (ast.where && !isSimpleCondition(ast.where.expression)) return false;

	// SORT must be simple (single key or missing)
	if (ast.sort && ast.sort.keys.length > 1) return false;

	// DISPLAY must be simple (no "all", just property list)
	if (ast.display?.all) return false;

	return true;
}

/**
 * Check if an expression is a simple comparison or existence check
 */
function isSimpleCondition(expr: ExprNode): boolean {
	// Simple property access (existence check like `when gender`)
	if (expr instanceof PropertyNode) return true;

	if (!(expr instanceof CompareExprNode)) return false;

	// Left must be a simple property access
	if (!(expr.left instanceof PropertyNode)) return false;

	// Right must be a literal (including null for existence checks)
	if (
		!(expr.right instanceof StringNode) &&
		!(expr.right instanceof NumberNode) &&
		!(expr.right instanceof BooleanNode) &&
		!(expr.right instanceof NullNode)
	) {
		return false;
	}

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
			relations: ast.from.relations.map((r) => ({
				name: r.name,
				depth: r.depth,
			})),
			where: parseConditionClause(ast.where?.expression),
			when: parseConditionClause(ast.when?.expression),
			sort: parseSortClause(ast),
			display: parseDisplayClause(ast),
		};
	} catch {
		return null;
	}
}

function parseConditionClause(expr?: ExprNode): VisualCondition | undefined {
	if (!expr) return undefined;

	// Handle simple property access (e.g., `when gender`) as existence check
	if (expr instanceof PropertyNode) {
		return {
			property: expr.path.join("."),
			operator: "exists",
		};
	}

	if (!(expr instanceof CompareExprNode)) return undefined;
	if (!(expr.left instanceof PropertyNode)) return undefined;

	const property = expr.left.path.join(".");

	// Handle null comparisons for exists/notExists
	if (expr.right instanceof NullNode) {
		if (expr.op === "=" || expr.op === "=?") {
			return {property, operator: "notExists"};
		} else if (expr.op === "!=" || expr.op === "!=?") {
			return {property, operator: "exists"};
		}
		return undefined;
	}

	let operator: VisualCondition["operator"] = "=";

	switch (expr.op) {
		case "=":
			operator = "=";
			break;
		case "!=":
			operator = "!=";
			break;
		case "<":
			operator = "<";
			break;
		case ">":
			operator = ">";
			break;
		case "<=":
			operator = "<=";
			break;
		case ">=":
			operator = ">=";
			break;
		default:
			return undefined;
	}

	let value: string | number | boolean;
	if (expr.right instanceof StringNode) {
		value = expr.right.value;
	} else if (expr.right instanceof NumberNode) {
		value = expr.right.value;
	} else if (expr.right instanceof BooleanNode) {
		value = expr.right.value;
	} else {
		return undefined;
	}

	return {property, operator, value};
}

function parseSortClause(ast: QueryNode): VisualSortKey | undefined {
	if (!ast.sort || ast.sort.keys.length === 0) return undefined;
	const key = ast.sort.keys[0];
	if (!key) return undefined;

	return {
		property: key.key.path.join("."),
		direction: key.direction,
	};
}

function parseDisplayClause(ast: QueryNode): string[] | undefined {
	if (!ast.display || ast.display.all) return undefined;
	if (ast.display.properties.length === 0) return undefined;

	return ast.display.properties.map((p) => p.path.join("."));
}

/**
 * Format a condition for TQL output
 */
function formatCondition(condition: VisualCondition): string {
	const {property, operator, value} = condition;

	// Existence checks
	if (operator === "exists") {
		return property;
	}
	if (operator === "notExists") {
		return `${property} = null`;
	}

	// Regular comparisons
	const valueStr = typeof value === "string" ? `"${value}"` : String(value ?? "");
	return `${property} ${operator} ${valueStr}`;
}

/**
 * Generate TQL from a visual representation
 */
export function visualToQuery(visual: VisualQuery): string {
	const lines: string[] = [];

	// GROUP clause
	lines.push(`group "${visual.name}"`);

	// FROM clause
	const relations = visual.relations
		.map((r) => {
			const depth = r.depth === "unlimited" ? "unlimited" : r.depth.toString();
			return `${r.name} depth ${depth}`;
		})
		.join(", ");
	lines.push(`from ${relations}`);

	// WHEN clause (condition on current note for visibility)
	if (visual.when && visual.when.property) {
		lines.push(`when ${formatCondition(visual.when)}`);
	}

	// WHERE clause (filter on results)
	if (visual.where && visual.where.property) {
		lines.push(`where ${formatCondition(visual.where)}`);
	}

	// SORT clause
	if (visual.sort) {
		lines.push(`sort ${visual.sort.property} ${visual.sort.direction}`);
	}

	// DISPLAY clause
	if (visual.display && visual.display.length > 0) {
		lines.push(`display ${visual.display.join(", ")}`);
	}

	return lines.join("\n");
}
