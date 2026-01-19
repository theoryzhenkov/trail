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
	AggregateExpr,
	AggregateSource,
	RelationSpec,
} from "./ast";
import type {ValidatedQuery} from "./validator";
import type {QueryContext} from "./context";
import type {QueryResult, QueryResultNode, QueryWarning, TraversalContext} from "./result";
import {emptyResult} from "./result";
import type {FileProperties, RelationEdge} from "../types";
import {callBuiltin, FunctionContext} from "./builtins";
import {RuntimeError} from "./errors";
import {buildChainStructure, getBasename, type ChainStructure} from "./chain-sort";

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
	
	// Aggregate function support
	private evaluatingAggregates: Set<string> = new Set();
	private aggregateCache: Map<string, Value> = new Map();

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
			if (relSpec.flatten) {
				// Use BFS to collect all unique reachable nodes as a flat list
				const nodes = this.traverseFlat(
					this.ctx.activeFilePath,
					relSpec.name,
					relSpec.depth === "unlimited" ? Infinity : relSpec.depth,
					relSpec.extend
				);
				results.push(...nodes);
			} else {
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
		}

		return results;
	}

	/**
	 * Traverse relation using BFS and return flat list of unique nodes.
	 * Used when `flatten` modifier is specified.
	 */
	private traverseFlat(
		startPath: string,
		relation: string,
		maxDepth: number,
		extendGroup?: string
	): QueryResultNode[] {
		const visited = new Set<string>([startPath]);
		const results: QueryResultNode[] = [];

		// BFS queue: [path, currentDepth, parent]
		const queue: Array<{path: string; depth: number; parent: string}> = [];

		// Initialize with direct neighbors
		const initialEdges = this.ctx.getOutgoingEdges(startPath, relation);
		for (const edge of initialEdges) {
			if (!visited.has(edge.toPath)) {
				visited.add(edge.toPath);
				queue.push({path: edge.toPath, depth: 1, parent: startPath});
			}
		}

		while (queue.length > 0) {
			const item = queue.shift()!;
			const {path, depth, parent} = item;

			const props = this.ctx.getProperties(path);
			const traversalPath = [startPath, path];
			
			// Build traversal context for expression evaluation
			const traversalCtx: TraversalContext = {
				depth: 1, // Always depth 1 in flattened output
				relation,
				isImplied: false,
				parent,
				path: traversalPath,
			};

			// Apply PRUNE filter
			if (this.query.prune) {
				const pruneResult = this.evaluateExpr(this.query.prune, path, props, traversalCtx);
				if (this.isTruthy(pruneResult)) {
					continue; // Skip this node (but we've already marked it visited)
				}
			}

			// Get the actual edge to preserve implied status
			const edges = this.ctx.getOutgoingEdges(parent, relation);
			const edge = edges.find(e => e.toPath === path);
			const implied = edge?.implied ?? false;
			const impliedFrom = edge?.impliedFrom;

			const visualDirection = this.ctx.getVisualDirection(relation);

			results.push({
				path,
				relation,
				depth: 1, // Flattened: all nodes at depth 1
				implied,
				impliedFrom,
				parent: startPath, // All nodes have the start path as parent in flat view
				traversalPath,
				properties: props,
				displayProperties: [],
				visualDirection,
				hasFilteredAncestor: false,
				children: [], // No children in flattened output
			});

			// Continue BFS if we haven't reached max depth
			if (depth < maxDepth) {
				const nextEdges = this.ctx.getOutgoingEdges(path, relation);
				for (const nextEdge of nextEdges) {
					if (!visited.has(nextEdge.toPath)) {
						visited.add(nextEdge.toPath);
						queue.push({path: nextEdge.toPath, depth: depth + 1, parent: path});
					}
				}
			}
		}

		// Handle extend at the end if specified
		if (extendGroup && results.length > 0) {
			// For flatten, we don't extend - the nodes are already flat
			// Extend would create nested structure which contradicts flatten
			this.warnings.push({
				message: `'extend' is ignored when 'flatten' is used on relation '${relation}'`
			});
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
		if (nodes.length <= 1) {
			// Still need to sort children
			return nodes.map((node) => ({
				...node,
				children: this.sortResults(node.children, keys),
			}));
		}

		// Check if chain sorting is needed
		const hasChainKey = keys.some((k) => k.key === "chain");
		
		let sorted: QueryResultNode[];
		
		if (hasChainKey) {
			// Build chain structure for these siblings
			const sequentialRelations = this.ctx.getSequentialRelations();
			const nodePaths = new Set(nodes.map((n) => n.path));
			const edgesBySource = this.buildEdgeMapForNodes(nodes);
			const chainStructure = buildChainStructure(nodePaths, edgesBySource, sequentialRelations);
			
			// Sort with chain awareness
			sorted = this.sortWithChains(nodes, keys, chainStructure);
		} else {
			// Simple property-based sort
			sorted = [...nodes].sort((a, b) => this.compareNodes(a, b, keys, null));
		}

		// Sort children recursively
		return sorted.map((node) => ({
			...node,
			children: this.sortResults(node.children, keys),
		}));
	}

	/**
	 * Build edge map for sibling nodes to detect chains
	 */
	private buildEdgeMapForNodes(nodes: QueryResultNode[]): Map<string, RelationEdge[]> {
		const edgeMap = new Map<string, RelationEdge[]>();
		for (const node of nodes) {
			// Get all outgoing edges for this node
			const edges = this.ctx.getOutgoingEdges(node.path);
			edgeMap.set(node.path, edges);
		}
		return edgeMap;
	}

	/**
	 * Sort nodes with chain awareness.
	 * Chains are kept together, sorted by the head node's properties.
	 */
	private sortWithChains(
		nodes: QueryResultNode[],
		keys: SortKey[],
		structure: ChainStructure
	): QueryResultNode[] {
		const nodeByPath = new Map(nodes.map((n) => [n.path, n]));
		
		// Determine chain sort position in keys
		const chainKeyIndex = keys.findIndex((k) => k.key === "chain");
		const isChainPrimary = chainKeyIndex === 0;
		
		if (isChainPrimary || structure.chains.size === 0) {
			// Chain sort primary: chains stay intact, sorted by head's properties
			return this.sortChainsPrimary(nodes, keys, structure, nodeByPath);
		}
		
		// Chain sort secondary: property sort first, then chain within groups
		return this.sortChainsSecondary(nodes, keys, structure, nodeByPath, chainKeyIndex);
	}

	/**
	 * Chain sort primary: chains are kept intact, sorted by head's properties.
	 */
	private sortChainsPrimary(
		nodes: QueryResultNode[],
		keys: SortKey[],
		structure: ChainStructure,
		nodeByPath: Map<string, QueryResultNode>
	): QueryResultNode[] {
		// Collect sort keys: chain heads + disconnected
		const sortKeys: Array<{path: string; isChainHead: boolean; node: QueryResultNode}> = [];

		for (const head of structure.chains.keys()) {
			const node = nodeByPath.get(head);
			if (node) {
				sortKeys.push({path: head, isChainHead: true, node});
			}
		}

		for (const path of structure.disconnected) {
			const node = nodeByPath.get(path);
			if (node) {
				sortKeys.push({path, isChainHead: false, node});
			}
		}

		// Filter out chain key for property comparison
		const nonChainKeys = keys.filter((k) => k.key !== "chain");

		// Sort by properties (excluding chain key)
		sortKeys.sort((a, b) => this.compareNodes(a.node, b.node, nonChainKeys, null));

		// Expand: chain heads become full chains, disconnected stay as-is
		const result: QueryResultNode[] = [];

		for (const key of sortKeys) {
			if (key.isChainHead) {
				const chain = structure.chains.get(key.path) ?? [];
				for (const path of chain) {
					const node = nodeByPath.get(path);
					if (node) {
						result.push(node);
					}
				}
			} else {
				result.push(key.node);
			}
		}

		return result;
	}

	/**
	 * Chain sort secondary: property sort first, then chain sort within property groups.
	 */
	private sortChainsSecondary(
		nodes: QueryResultNode[],
		keys: SortKey[],
		structure: ChainStructure,
		nodeByPath: Map<string, QueryResultNode>,
		chainKeyIndex: number
	): QueryResultNode[] {
		// Get keys before the chain key
		const keysBeforeChain = keys.slice(0, chainKeyIndex);
		
		// Sort all nodes by properties before chain key
		const sortedByProps = [...nodes].sort((a, b) => 
			this.compareNodes(a, b, keysBeforeChain, null)
		);

		if (keysBeforeChain.length === 0) {
			// No properties before chain, use primary chain sort
			return this.sortChainsPrimary(nodes, keys, structure, nodeByPath);
		}

		// Group nodes by their primary sort key value
		const primaryKey = keysBeforeChain[0];
		if (!primaryKey || primaryKey.key === "chain") {
			return this.sortChainsPrimary(nodes, keys, structure, nodeByPath);
		}

		const groups = this.groupByPropertyValue(sortedByProps, primaryKey);

		// Apply chain sorting within each group
		const result: QueryResultNode[] = [];
		const keysAfterChain = keys.slice(chainKeyIndex + 1);
		
		for (const group of groups) {
			if (group.length <= 1) {
				result.push(...group);
				continue;
			}

			// Build chain structure for this subgroup
			const groupPaths = new Set(group.map((n) => n.path));
			const groupStructure = this.filterChainStructure(structure, groupPaths);

			if (groupStructure.chains.size === 0) {
				// No chains in this group, keep property-sorted order
				result.push(...group);
			} else {
				// Apply chain sorting within this property group
				const groupNodeByPath = new Map(group.map((n) => [n.path, n]));
				result.push(...this.sortChainsPrimary(group, keysAfterChain, groupStructure, groupNodeByPath));
			}
		}

		return result;
	}

	/**
	 * Filter chain structure to only include paths in the given set
	 */
	private filterChainStructure(structure: ChainStructure, paths: Set<string>): ChainStructure {
		const filteredChains = new Map<string, string[]>();
		const filteredDisconnected: string[] = [];
		const includedInChain = new Set<string>();

		for (const chain of structure.chains.values()) {
			const filteredChain = chain.filter((p) => paths.has(p));
			if (filteredChain.length > 1) {
				// Chain still has multiple members in this group
				const newHead = filteredChain[0]!;
				filteredChains.set(newHead, filteredChain);
				filteredChain.forEach((p) => includedInChain.add(p));
			} else if (filteredChain.length === 1) {
				// Single node - treat as disconnected
				filteredDisconnected.push(filteredChain[0]!);
			}
		}

		// Add disconnected nodes that are in paths
		for (const path of structure.disconnected) {
			if (paths.has(path)) {
				filteredDisconnected.push(path);
			}
		}

		// Add any paths that weren't in the original structure
		for (const path of paths) {
			if (!includedInChain.has(path) && !filteredDisconnected.includes(path)) {
				filteredDisconnected.push(path);
			}
		}

		return {chains: filteredChains, disconnected: filteredDisconnected};
	}

	/**
	 * Group nodes by their value for a sort key
	 */
	private groupByPropertyValue(nodes: QueryResultNode[], key: SortKey): QueryResultNode[][] {
		if (key.key === "chain") {
			return [nodes]; // Can't group by chain
		}

		const groups = new Map<string, QueryResultNode[]>();
		const order: string[] = [];

		for (const node of nodes) {
			const propPath = key.key.path.join(".");
			const value = this.getPropertyValue(node.properties, propPath);
			const valueStr = value === null ? "" : String(value);
			
			if (!groups.has(valueStr)) {
				groups.set(valueStr, []);
				order.push(valueStr);
			}
			groups.get(valueStr)!.push(node);
		}

		return order.map((k) => groups.get(k)!);
	}

	private compareNodes(
		a: QueryResultNode,
		b: QueryResultNode,
		keys: SortKey[],
		_chainStructure: ChainStructure | null
	): number {
		for (const key of keys) {
			if (key.key === "chain") {
				// Chain comparison handled at higher level
				continue;
			}

			// Property sort
			const propPath = key.key.path.join(".");
			const aVal = this.getPropertyValue(a.properties, propPath);
			const bVal = this.getPropertyValue(b.properties, propPath);
			let cmp = this.compareValues(aVal, bVal);

			if (key.direction === "desc") {
				cmp = -cmp;
			}

			if (cmp !== 0) {
				return cmp;
			}
		}
		
		// Fallback: alphabetical by basename
		return getBasename(a.path).localeCompare(getBasename(b.path));
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

		// Normalize undefined to null - TQL uses null as canonical "no value"
		return (current === undefined ? null : current) as Value;
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

			case "aggregate":
				return this.evaluateAggregate(expr, filePath, props, traversal);

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

		// Equality with null: x = null checks if x is null
		// Note: undefined is normalized to null at property access layer
		if (expr.op === "=" || expr.op === "!=") {
			if (right === null) {
				return expr.op === "=" ? left === null : left !== null;
			}
			if (left === null) {
				return expr.op === "=" ? right === null : right !== null;
			}
			// Neither is null - compare normally
			return expr.op === "=" ? this.equals(left, right) : !this.equals(left, right);
		}

		// Standard comparison operators - null propagates
		if (left === null || right === null) {
			return null;
		}

		switch (expr.op) {
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

	// =========================================================================
	// Aggregate Evaluation
	// =========================================================================

	private evaluateAggregate(
		expr: AggregateExpr,
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		// Build cache key
		const sourceKey = this.getAggregateSourceKey(expr.source);
		const propertyKey = expr.property?.path.join(".") ?? "";
		const conditionKey = expr.condition ? JSON.stringify(expr.condition) : "";
		const cacheKey = `${filePath}:${expr.func}:${sourceKey}:${propertyKey}:${conditionKey}`;

		// Check cache
		if (this.aggregateCache.has(cacheKey)) {
			return this.aggregateCache.get(cacheKey)!;
		}

		// Cycle detection
		if (this.evaluatingAggregates.has(cacheKey)) {
			this.warnings.push({message: `Circular aggregate reference detected`});
			return null;
		}
		this.evaluatingAggregates.add(cacheKey);

		try {
			// Execute subquery from current node
			const results = this.executeSubquery(expr.source, filePath);

			// Compute aggregate
			const value = this.computeAggregate(expr, results, filePath, props, traversal);

			// Cache result
			this.aggregateCache.set(cacheKey, value);
			return value;
		} finally {
			this.evaluatingAggregates.delete(cacheKey);
		}
	}

	private getAggregateSourceKey(source: AggregateSource): string {
		if (source.type === "groupRef") {
			return `group:${source.name}`;
		} else if (source.type === "inlineFrom") {
			return `from:${JSON.stringify(source.relations.map(r => ({n: r.name, d: r.depth})))}`;
		} else {
			return `bare:${source.name}`;
		}
	}

	private executeSubquery(source: AggregateSource, fromPath: string): QueryResultNode[] {
		let relations: RelationSpec[];

		if (source.type === "groupRef") {
			// Explicit group reference
			const groupQuery = this.ctx.resolveGroupQuery(source.name);
			relations = groupQuery?.from.relations ?? [];
		} else if (source.type === "inlineFrom") {
			// Explicit from clause
			relations = source.relations;
		} else {
			// Bare identifier - resolve to group or relation
			// Validator ensured no ambiguity, so we try group first
			const groupQuery = this.ctx.resolveGroupQuery(source.name);
			if (groupQuery) {
				relations = groupQuery.from.relations;
			} else {
				// Treat as relation with unlimited depth
				relations = [{
					type: "relationSpec" as const,
					name: source.name,
					depth: "unlimited" as const,
					span: source.span,
				}];
			}
		}

		const results: QueryResultNode[] = [];
		const ancestorPaths = new Set([fromPath]);
		const traversalPath = [fromPath];

		for (const relSpec of relations) {
			const nodes = this.traverseRelation(
				fromPath,
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

	private computeAggregate(
		expr: AggregateExpr,
		results: QueryResultNode[],
		filePath: string,
		props: FileProperties,
		traversal?: TraversalContext
	): Value {
		// Flatten tree to list for aggregation
		const allNodes = this.flattenTree(results);

		switch (expr.func) {
			case "count":
				return allNodes.length;

			case "sum":
				return this.computeSum(allNodes, expr.property!);

			case "avg":
				return this.computeAvg(allNodes, expr.property!);

			case "min":
				return this.computeMin(allNodes, expr.property!);

			case "max":
				return this.computeMax(allNodes, expr.property!);

			case "any":
				return this.computeAny(allNodes, expr.condition!, filePath, props, traversal);

			case "all":
				return this.computeAll(allNodes, expr.condition!, filePath, props, traversal);
		}
	}

	private flattenTree(nodes: QueryResultNode[]): QueryResultNode[] {
		const result: QueryResultNode[] = [];
		for (const node of nodes) {
			result.push(node);
			result.push(...this.flattenTree(node.children));
		}
		return result;
	}

	private computeSum(nodes: QueryResultNode[], prop: PropertyAccess): number {
		let sum = 0;
		for (const node of nodes) {
			const val = this.getPropertyValue(node.properties, prop.path.join("."));
			if (typeof val === "number") {
				sum += val;
			}
			// Ignore null/non-numeric values
		}
		return sum;
	}

	private computeAvg(nodes: QueryResultNode[], prop: PropertyAccess): number | null {
		let sum = 0;
		let count = 0;
		for (const node of nodes) {
			const val = this.getPropertyValue(node.properties, prop.path.join("."));
			if (typeof val === "number") {
				sum += val;
				count++;
			}
			// Ignore null/non-numeric values
		}
		return count > 0 ? sum / count : null;
	}

	private computeMin(nodes: QueryResultNode[], prop: PropertyAccess): Value {
		let min: Value = null;
		for (const node of nodes) {
			const val = this.getPropertyValue(node.properties, prop.path.join("."));
			if (val === null) continue;
			if (min === null || this.compare(val, min) < 0) {
				min = val;
			}
		}
		return min;
	}

	private computeMax(nodes: QueryResultNode[], prop: PropertyAccess): Value {
		let max: Value = null;
		for (const node of nodes) {
			const val = this.getPropertyValue(node.properties, prop.path.join("."));
			if (val === null) continue;
			if (max === null || this.compare(val, max) > 0) {
				max = val;
			}
		}
		return max;
	}

	private computeAny(
		nodes: QueryResultNode[],
		condition: Expr,
		_filePath: string,
		_props: FileProperties,
		_traversal?: TraversalContext
	): boolean {
		for (const node of nodes) {
			const nodeTraversal: TraversalContext = {
				depth: node.depth,
				relation: node.relation,
				isImplied: node.implied,
				parent: node.parent,
				path: node.traversalPath,
			};
			const result = this.evaluateExpr(condition, node.path, node.properties, nodeTraversal);
			if (this.isTruthy(result)) {
				return true;
			}
		}
		return false;
	}

	private computeAll(
		nodes: QueryResultNode[],
		condition: Expr,
		_filePath: string,
		_props: FileProperties,
		_traversal?: TraversalContext
	): boolean {
		if (nodes.length === 0) {
			return true; // vacuously true
		}
		for (const node of nodes) {
			const nodeTraversal: TraversalContext = {
				depth: node.depth,
				relation: node.relation,
				isImplied: node.implied,
				parent: node.parent,
				path: node.traversalPath,
			};
			const result = this.evaluateExpr(condition, node.path, node.properties, nodeTraversal);
			if (!this.isTruthy(result)) {
				return false;
			}
		}
		return true;
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
