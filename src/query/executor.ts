/**
 * TQL Executor - Executes validated queries against the graph
 */

import type {
	Query,
	Expr,
	Value,
	PropertyAccess,
	SortKey,
	DisplayClause,
	DateExpr,
} from "./ast";
import type {ValidatedQuery} from "./validator";
import type {QueryContext} from "./context";
import type {QueryResult, QueryResultNode, QueryWarning, TraversalContext} from "./result";
import {emptyResult} from "./result";
import type {RelationEdge, FileProperties, VisualDirection} from "../types";
import {callBuiltin, FunctionContext} from "./builtins";
import {RuntimeError} from "./errors";

/**
 * Execute a validated TQL query
 */
export function execute(query: ValidatedQuery, ctx: QueryContext): QueryResult {
	const executor = new Executor(query, ctx);
	return executor.execute();
}

/**
 * Internal executor class
 */
class Executor {
	private query: Query;
	private ctx: QueryContext;
	private warnings: QueryWarning[] = [];

	constructor(query: ValidatedQuery, ctx: QueryContext) {
		this.query = query;
		this.ctx = ctx;
	}

	execute(): QueryResult {
		// 1. Evaluate WHEN clause against active file
		if (this.query.when) {
			const whenResult = this.evaluateExpr(
				this.query.when,
				this.ctx.activeFilePath,
				this.ctx.activeFileProperties
			);
			if (!this.isTruthy(whenResult)) {
				return emptyResult(false);
			}
		}

		// 2. Traverse FROM clause
		const results = this.traverse();

		// 3. Apply WHERE filter (post-traversal)
		const filtered = this.query.where
			? this.applyWhereFilter(results)
			: results;

		// 4. Sort results
		const sorted = this.query.sort
			? this.sortResults(filtered, this.query.sort)
			: filtered;

		// 5. Apply DISPLAY clause
		const displayed = this.applyDisplay(sorted, this.query.display);

		return {
			visible: true,
			results: displayed,
			warnings: this.warnings,
		};
	}

	// =========================================================================
	// Traversal
	// =========================================================================

	private traverse(): QueryResultNode[] {
		const results: QueryResultNode[] = [];
		const ancestorPaths = new Set<string>([this.ctx.activeFilePath]);
		const traversalPath = [this.ctx.activeFilePath];

		for (const relSpec of this.query.from.relations) {
			const nodes = this.traverseRelation(
				this.ctx.activeFilePath,
				relSpec.name,
				relSpec.depth === "unlimited" ? Infinity : relSpec.depth,
				1,
				ancestorPaths,
				traversalPath,
				relSpec.extend
			);
			results.push(...nodes);
		}

		return results;
	}

	private traverseRelation(
		sourcePath: string,
		relation: string,
		maxDepth: number,
		currentDepth: number,
		ancestorPaths: Set<string>,
		traversalPath: string[],
		extendGroup?: string
	): QueryResultNode[] {
		if (currentDepth > maxDepth) {
			// At leaf - check for extend
			if (extendGroup) {
				return this.extendFromGroup(sourcePath, extendGroup, ancestorPaths, traversalPath);
			}
			return [];
		}

		const edges = this.ctx.getOutgoingEdges(sourcePath, relation);
		const results: QueryResultNode[] = [];

		for (const edge of edges) {
			// Cycle detection (per-path)
			if (ancestorPaths.has(edge.toPath)) {
				continue;
			}

			const props = this.ctx.getProperties(edge.toPath);
			const newPath = [...traversalPath, edge.toPath];
			
			// Build traversal context for expression evaluation
			const traversalCtx: TraversalContext = {
				depth: currentDepth,
				relation: edge.relation,
				isImplied: edge.implied,
				parent: sourcePath,
				path: newPath,
			};

			// Apply PRUNE filter
			if (this.query.prune) {
				const pruneResult = this.evaluateExpr(this.query.prune, edge.toPath, props, traversalCtx);
				if (this.isTruthy(pruneResult)) {
					continue; // Skip this node and its subtree
				}
			}

			const visualDirection = this.ctx.getVisualDirection(edge.relation);

			// Traverse children
			const newAncestors = new Set(ancestorPaths);
			newAncestors.add(edge.toPath);

			const children = this.traverseRelation(
				edge.toPath,
				relation,
				maxDepth,
				currentDepth + 1,
				newAncestors,
				newPath,
				extendGroup
			);

			results.push({
				path: edge.toPath,
				relation: edge.relation,
				depth: currentDepth,
				implied: edge.implied,
				impliedFrom: edge.impliedFrom,
				parent: sourcePath,
				traversalPath: newPath,
				properties: props,
				displayProperties: [],
				visualDirection,
				hasFilteredAncestor: false,
				children,
			});
		}

		return results;
	}

	private extendFromGroup(
		sourcePath: string,
		groupName: string,
		ancestorPaths: Set<string>,
		traversalPath: string[]
	): QueryResultNode[] {
		const groupQuery = this.ctx.resolveGroupQuery(groupName);
		if (!groupQuery) {
			this.warnings.push({message: `Cannot resolve group for extend: ${groupName}`});
			return [];
		}

		// Execute the group's FROM clause from this source
		const results: QueryResultNode[] = [];
		for (const relSpec of groupQuery.from.relations) {
			const nodes = this.traverseRelation(
				sourcePath,
				relSpec.name,
				relSpec.depth === "unlimited" ? Infinity : relSpec.depth,
				1,
				ancestorPaths,
				traversalPath,
				relSpec.extend
			);
			results.push(...nodes);
		}
		return results;
	}

	// =========================================================================
	// WHERE Filtering
	// =========================================================================

	private applyWhereFilter(nodes: QueryResultNode[]): QueryResultNode[] {
		const result: QueryResultNode[] = [];

		for (const node of nodes) {
			// Build traversal context from node
			const traversalCtx: TraversalContext = {
				depth: node.depth,
				relation: node.relation,
				isImplied: node.implied,
				parent: node.parent,
				path: node.traversalPath,
			};

			const whereResult = this.evaluateExpr(
				this.query.where!,
				node.path,
				node.properties,
				traversalCtx
			);

			// Filter children first
			const filteredChildren = this.applyWhereFilter(node.children);

			if (this.isTruthy(whereResult)) {
				// Node passes filter - include it
				result.push({
					...node,
					children: filteredChildren,
				});
			} else if (filteredChildren.length > 0) {
				// Node filtered but has visible children - mark them
				const markedChildren = filteredChildren.map((child) => ({
					...child,
					hasFilteredAncestor: true,
				}));
				result.push(...markedChildren);
			}
			// If node filtered and no visible children, exclude entirely
		}

		return result;
	}

	// =========================================================================
	// Sorting
	// =========================================================================

	private sortResults(nodes: QueryResultNode[], keys: SortKey[]): QueryResultNode[] {
		// Sort recursively
		const sorted = [...nodes].sort((a, b) => this.compareNodes(a, b, keys));

		// Sort children
		return sorted.map((node) => ({
			...node,
			children: this.sortResults(node.children, keys),
		}));
	}

	private compareNodes(a: QueryResultNode, b: QueryResultNode, keys: SortKey[]): number {
		for (const key of keys) {
			let cmp: number;

			if (key.key === "chain") {
				// Chain sort - use sequence/position if available
				cmp = this.compareChain(a, b);
			} else {
				// Property sort
				const propPath = key.key.path.join(".");
				const aVal = this.getPropertyValue(a.properties, propPath);
				const bVal = this.getPropertyValue(b.properties, propPath);
				cmp = this.compareValues(aVal, bVal);
			}

			if (key.direction === "desc") {
				cmp = -cmp;
			}

			if (cmp !== 0) {
				return cmp;
			}
		}
		return 0;
	}

	private compareChain(a: QueryResultNode, b: QueryResultNode): number {
		// Chain comparison based on sequential relations
		// For now, just compare by path as fallback
		return a.path.localeCompare(b.path);
	}

	private compareValues(a: Value, b: Value): number {
		// Nulls sort last
		if (a === null && b === null) return 0;
		if (a === null) return 1;
		if (b === null) return -1;

		// Type-specific comparison
		if (typeof a === "number" && typeof b === "number") {
			return a - b;
		}
		if (typeof a === "string" && typeof b === "string") {
			return a.localeCompare(b);
		}
		if (a instanceof Date && b instanceof Date) {
			return a.getTime() - b.getTime();
		}

		// Fallback: string comparison
		return String(a).localeCompare(String(b));
	}

	private getPropertyValue(props: FileProperties, path: string): Value {
		const parts = path.split(".");
		let current: unknown = props;

		for (const part of parts) {
			if (current === null || current === undefined) {
				return null;
			}
			if (typeof current === "object" && current !== null) {
				current = (current as Record<string, unknown>)[part];
			} else {
				return null;
			}
		}

		return current as Value;
	}

	// =========================================================================
	// Display
	// =========================================================================

	private applyDisplay(
		nodes: QueryResultNode[],
		display?: DisplayClause
	): QueryResultNode[] {
		if (!display) {
			return nodes;
		}

		return nodes.map((node) => ({
			...node,
			displayProperties: this.getDisplayProperties(node.properties, display),
			children: this.applyDisplay(node.children, display),
		}));
	}

	private getDisplayProperties(props: FileProperties, display: DisplayClause): string[] {
		if (display.all) {
			// All frontmatter properties + explicit ones
			const allProps = Object.keys(props).filter(
				(k) => !k.startsWith("file.") && !k.startsWith("traversal.")
			);
			const explicit = display.properties.map((p) => p.path.join("."));
			return [...new Set([...allProps, ...explicit])];
		}

		return display.properties.map((p) => p.path.join("."));
	}

	// =========================================================================
	// Expression Evaluation
	// =========================================================================

	private evaluateExpr(
		expr: Expr,
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		switch (expr.type) {
			case "logical":
				return this.evaluateLogical(expr, filePath, props, traversal);

			case "compare":
				return this.evaluateCompare(expr, filePath, props, traversal);

			case "arith":
				return this.evaluateArith(expr, filePath, props, traversal);

			case "unary":
				return this.evaluateUnary(expr, filePath, props, traversal);

			case "in":
				return this.evaluateIn(expr, filePath, props, traversal);

			case "range":
				return this.evaluateRange(expr, filePath, props, traversal);

			case "call":
				return this.evaluateCall(expr, filePath, props, traversal);

			case "property":
				return this.evaluateProperty(expr, props, traversal, filePath);

			case "dateExpr":
				return this.evaluateDateExpr(expr, filePath, props, traversal);

			case "string":
				return expr.value;

			case "number":
				return expr.value;

			case "boolean":
				return expr.value;

			case "null":
				return null;

			case "duration":
				// Return as milliseconds for arithmetic
				return this.durationToMs(expr.value, expr.unit);

			case "date":
				return expr.value;

			default:
				throw new RuntimeError(`Unknown expression type: ${(expr as Expr).type}`);
		}
	}

	private evaluateLogical(
		expr: {op: "and" | "or"; left: Expr; right: Expr},
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		const left = this.evaluateExpr(expr.left, filePath, props, traversal);

		if (expr.op === "and") {
			if (!this.isTruthy(left)) return false;
			return this.isTruthy(this.evaluateExpr(expr.right, filePath, props, traversal));
		} else {
			if (this.isTruthy(left)) return true;
			return this.isTruthy(this.evaluateExpr(expr.right, filePath, props, traversal));
		}
	}

	private evaluateCompare(
		expr: {op: string; left: Expr; right: Expr},
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		const left = this.evaluateExpr(expr.left, filePath, props, traversal);
		const right = this.evaluateExpr(expr.right, filePath, props, traversal);

		// Null-safe operators
		if (expr.op === "=?") {
			if (left === null) return false;
			return this.equals(left, right);
		}
		if (expr.op === "!=?") {
			if (left === null) return true;
			return !this.equals(left, right);
		}

		// Standard operators - null propagates
		if (left === null || right === null) {
			return null;
		}

		switch (expr.op) {
			case "=":
				return this.equals(left, right);
			case "!=":
				return !this.equals(left, right);
			case "<":
				return this.compare(left, right) < 0;
			case ">":
				return this.compare(left, right) > 0;
			case "<=":
				return this.compare(left, right) <= 0;
			case ">=":
				return this.compare(left, right) >= 0;
			default:
				throw new RuntimeError(`Unknown operator: ${expr.op}`);
		}
	}

	private evaluateArith(
		expr: {op: "+" | "-"; left: Expr; right: Expr},
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		const left = this.evaluateExpr(expr.left, filePath, props, traversal);
		const right = this.evaluateExpr(expr.right, filePath, props, traversal);

		if (left === null || right === null) {
			return null;
		}

		// Date arithmetic
		if (left instanceof Date && typeof right === "number") {
			const ms = expr.op === "+" ? left.getTime() + right : left.getTime() - right;
			return new Date(ms);
		}

		// Number arithmetic
		if (typeof left === "number" && typeof right === "number") {
			return expr.op === "+" ? left + right : left - right;
		}

		// String concatenation
		if (typeof left === "string" && expr.op === "+") {
			return left + String(right);
		}

		throw new RuntimeError(`Cannot perform ${expr.op} on ${typeof left} and ${typeof right}`);
	}

	private evaluateUnary(
		expr: {op: "not"; operand: Expr},
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		const operand = this.evaluateExpr(expr.operand, filePath, props, traversal);
		return !this.isTruthy(operand);
	}

	private evaluateIn(
		expr: {value: Expr; collection: Expr},
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		const value = this.evaluateExpr(expr.value, filePath, props, traversal);
		const collection = this.evaluateExpr(expr.collection, filePath, props, traversal);

		if (collection === null) {
			return false;
		}

		// Array membership
		if (Array.isArray(collection)) {
			return collection.some((item) => this.equals(value, item));
		}

		// String substring
		if (typeof collection === "string" && typeof value === "string") {
			return collection.includes(value);
		}

		return false;
	}

	private evaluateRange(
		expr: {value: Expr; lower: Expr; upper: Expr},
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		const value = this.evaluateExpr(expr.value, filePath, props, traversal);
		const lower = this.evaluateExpr(expr.lower, filePath, props, traversal);
		const upper = this.evaluateExpr(expr.upper, filePath, props, traversal);

		if (value === null || lower === null || upper === null) {
			return null;
		}

		return this.compare(value, lower) >= 0 && this.compare(value, upper) <= 0;
	}

	private evaluateCall(
		expr: {name: string; args: Expr[]},
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		const args = expr.args.map((arg) => this.evaluateExpr(arg, filePath, props, traversal));

		const fnCtx: FunctionContext = {
			filePath,
			getProperties: (path) => this.ctx.getProperties(path) as Record<string, Value>,
			getFileMetadata: (path) => this.ctx.getFileMetadata(path),
		};

		return callBuiltin(expr.name, args, fnCtx);
	}

	private evaluateProperty(
		expr: PropertyAccess,
		props: FileProperties,
		traversal?: TraversalContext,
		filePath?: string
	): Value {
		const path = expr.path;
		
		// Handle traversal.* properties
		if (path[0] === "traversal" && traversal) {
			switch (path[1]) {
				case "depth":
					return traversal.depth;
				case "relation":
					return traversal.relation;
				case "isImplied":
					return traversal.isImplied;
				case "parent":
					return traversal.parent;
				case "path":
					return traversal.path;
				default:
					return null;
			}
		}
		
		// Handle file.* properties from file metadata
		if (path[0] === "file" && filePath) {
			return this.getFileProperty(filePath, path[1]);
		}
		
		return this.getPropertyValue(props, path.join("."));
	}

	private getFileProperty(filePath: string, property: string | undefined): Value {
		if (!property) return null;
		
		const metadata = this.ctx.getFileMetadata(filePath);
		if (!metadata) return null;
		
		switch (property) {
			case "name":
				return metadata.name;
			case "path":
				return metadata.path;
			case "folder":
				return metadata.folder;
			case "created":
				return metadata.created;
			case "modified":
				return metadata.modified;
			case "size":
				return metadata.size;
			case "tags":
				return metadata.tags;
			default:
				return null;
		}
	}

	private evaluateDateExpr(
		expr: DateExpr,
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		let base: Value;

		if (expr.base.type === "relativeDate") {
			base = this.resolveRelativeDate(expr.base.kind);
		} else if (expr.base.type === "date") {
			base = expr.base.value;
		} else if (expr.base.type === "property") {
			base = this.evaluateProperty(expr.base, props, traversal, filePath);
		} else {
			// Should not happen with proper typing
			base = null;
		}

		if (!expr.offset || !(base instanceof Date)) {
			return base;
		}

		const durationExpr = expr.offset.duration;
		const durationMs = this.durationToMs(durationExpr.value, durationExpr.unit);

		const ms = expr.offset.op === "+" ? base.getTime() + durationMs : base.getTime() - durationMs;
		return new Date(ms);
	}

	private resolveRelativeDate(kind: string): Date {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		switch (kind) {
			case "today":
				return today;
			case "yesterday":
				return new Date(today.getTime() - 24 * 60 * 60 * 1000);
			case "tomorrow":
				return new Date(today.getTime() + 24 * 60 * 60 * 1000);
			case "startOfWeek": {
				const day = today.getDay();
				return new Date(today.getTime() - day * 24 * 60 * 60 * 1000);
			}
			case "endOfWeek": {
				const day = today.getDay();
				return new Date(today.getTime() + (6 - day) * 24 * 60 * 60 * 1000);
			}
			default:
				return today;
		}
	}

	private durationToMs(value: number, unit: "d" | "w" | "m" | "y"): number {
		const day = 24 * 60 * 60 * 1000;
		switch (unit) {
			case "d":
				return value * day;
			case "w":
				return value * 7 * day;
			case "m":
				return value * 30 * day; // Approximate
			case "y":
				return value * 365 * day; // Approximate
		}
	}

	// =========================================================================
	// Helpers
	// =========================================================================

	private isTruthy(value: Value): boolean {
		if (value === null) return false;
		if (value === false) return false;
		if (value === 0) return false;
		if (value === "") return false;
		if (Array.isArray(value) && value.length === 0) return false;
		return true;
	}

	private equals(a: Value, b: Value): boolean {
		if (a === b) return true;
		if (a === null || b === null) return false;
		if (a instanceof Date && b instanceof Date) {
			return a.getTime() === b.getTime();
		}
		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) return false;
			return a.every((v, i) => this.equals(v, b[i] ?? null));
		}
		return a === b;
	}

	private compare(a: Value, b: Value): number {
		if (a === b) return 0;
		if (a === null) return 1;
		if (b === null) return -1;

		if (typeof a === "number" && typeof b === "number") {
			return a - b;
		}
		if (typeof a === "string" && typeof b === "string") {
			return a.localeCompare(b);
		}
		if (a instanceof Date && b instanceof Date) {
			return a.getTime() - b.getTime();
		}

		return String(a).localeCompare(String(b));
	}
}
