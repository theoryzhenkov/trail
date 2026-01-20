/**
 * Graph traversal logic for TQL query execution
 */

import type {ExecutorContext} from "../context";
import type {ExprNode} from "../base/ExprNode";
import type {QueryResultNode, TraversalContext, QueryWarning} from "../types";

/**
 * Options for traversal operations
 */
export interface TraversalOptions {
	/** Starting file path */
	startPath: string;
	/** Relation to traverse */
	relation: string;
	/** Maximum depth (Infinity for unlimited) */
	maxDepth: number;
	/** Optional group name for extend */
	extendGroup?: string;
	/** Flatten: true = flatten all (BFS), number = flatten from depth N */
	flatten?: number | true;
	/** Prune expression (skip nodes where this evaluates to true) */
	pruneExpr?: ExprNode;
	/** Callback to resolve group queries for extend */
	resolveGroup?: (name: string) => TraversalOptions[] | undefined;
}

/**
 * Result of a traversal operation
 */
export interface TraversalResult {
	nodes: QueryResultNode[];
	warnings: QueryWarning[];
}

/**
 * Traverse a relation and return result nodes
 */
export function traverse(ctx: ExecutorContext, options: TraversalOptions): TraversalResult {
	const warnings: QueryWarning[] = [];

	if (options.flatten === true) {
		// Full flatten: BFS, all nodes at depth 1
		const nodes = traverseFlat(ctx, options, warnings);
		return {nodes, warnings};
	}

	if (typeof options.flatten === "number") {
		// Partial flatten: DFS with tree structure until flattenDepth, then flatten
		const ancestorPaths = new Set<string>([options.startPath]);
		const traversalPath = [options.startPath];
		const nodes = traverseWithPartialFlatten(
			ctx, options, 1, ancestorPaths, traversalPath, warnings, options.flatten
		);
		return {nodes, warnings};
	}

	// No flatten: normal DFS tree traversal
	const ancestorPaths = new Set<string>([options.startPath]);
	const traversalPath = [options.startPath];
	const nodes = traverseRelation(ctx, options, 1, ancestorPaths, traversalPath, warnings);
	return {nodes, warnings};
}

/**
 * BFS traversal for flatten modifier - returns flat list of unique nodes
 */
function traverseFlat(
	ctx: ExecutorContext,
	options: TraversalOptions,
	warnings: QueryWarning[]
): QueryResultNode[] {
	const {startPath, relation, maxDepth, extendGroup, pruneExpr} = options;
	const visited = new Set<string>([startPath]);
	const results: QueryResultNode[] = [];

	// BFS queue
	const queue: Array<{path: string; depth: number; parent: string}> = [];

	// Initialize with direct neighbors
	const initialEdges = ctx.getOutgoingEdges(startPath, relation);
	for (const edge of initialEdges) {
		if (!visited.has(edge.toPath)) {
			visited.add(edge.toPath);
			queue.push({path: edge.toPath, depth: 1, parent: startPath});
		}
	}

	while (queue.length > 0) {
		const item = queue.shift()!;
		const {path, depth, parent} = item;

		const props = ctx.getProperties(path);
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
		if (pruneExpr) {
			ctx.setCurrentFile(path, props);
			ctx.setTraversal(traversalCtx);
			const pruneResult = pruneExpr.evaluate(ctx);
			if (ctx.isTruthy(pruneResult)) {
				continue; // Skip this node
			}
		}

		// Get the actual edge to preserve implied status
		const edges = ctx.getOutgoingEdges(parent, relation);
		const edge = edges.find((e) => e.toPath === path);
		const implied = edge?.implied ?? false;
		const impliedFrom = edge?.impliedFrom;

		const visualDirection = ctx.getVisualDirection(relation);

		results.push({
			path,
			relation,
			depth: 1,
			implied,
			impliedFrom,
			parent: startPath,
			traversalPath,
			properties: props,
			displayProperties: [],
			visualDirection,
			hasFilteredAncestor: false,
			children: [],
		});

		// Continue BFS if we haven't reached max depth
		if (depth < maxDepth) {
			const nextEdges = ctx.getOutgoingEdges(path, relation);
			for (const nextEdge of nextEdges) {
				if (!visited.has(nextEdge.toPath)) {
					visited.add(nextEdge.toPath);
					queue.push({path: nextEdge.toPath, depth: depth + 1, parent: path});
				}
			}
		}
	}

	// Warn if extend is used with flatten
	if (extendGroup && results.length > 0) {
		warnings.push({
			message: `'extend' is ignored when 'flatten' is used on relation '${relation}'`,
		});
	}

	return results;
}

/**
 * DFS traversal with partial flatten - tree structure until flattenDepth, then flatten
 */
function traverseWithPartialFlatten(
	ctx: ExecutorContext,
	options: TraversalOptions,
	currentDepth: number,
	ancestorPaths: Set<string>,
	traversalPath: string[],
	warnings: QueryWarning[],
	flattenDepth: number
): QueryResultNode[] {
	const {relation, maxDepth, extendGroup, pruneExpr, resolveGroup} = options;

	if (currentDepth > maxDepth) {
		// At leaf - check for extend
		if (extendGroup && resolveGroup) {
			return extendFromGroup(
				ctx,
				traversalPath[traversalPath.length - 1]!,
				extendGroup,
				ancestorPaths,
				traversalPath,
				warnings,
				pruneExpr,
				resolveGroup
			);
		}
		return [];
	}

	const sourcePath = traversalPath[traversalPath.length - 1]!;
	const edges = ctx.getOutgoingEdges(sourcePath, relation);
	const results: QueryResultNode[] = [];

	for (const edge of edges) {
		// Cycle detection (per-path)
		if (ancestorPaths.has(edge.toPath)) {
			continue;
		}

		const props = ctx.getProperties(edge.toPath);
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
		if (pruneExpr) {
			ctx.setCurrentFile(edge.toPath, props);
			ctx.setTraversal(traversalCtx);
			const pruneResult = pruneExpr.evaluate(ctx);
			if (ctx.isTruthy(pruneResult)) {
				continue; // Skip this node and its subtree
			}
		}

		const visualDirection = ctx.getVisualDirection(edge.relation);

		// Traverse children
		const newAncestors = new Set(ancestorPaths);
		newAncestors.add(edge.toPath);

		let children: QueryResultNode[];

		if (currentDepth >= flattenDepth) {
			// At or beyond flatten depth: collect all descendants as flat children
			children = collectDescendantsFlat(
				ctx, options, newAncestors, newPath, warnings, currentDepth + 1
			);
		} else {
			// Before flatten depth: continue with partial flatten
			const childOptions: TraversalOptions = {
				...options,
				startPath: edge.toPath,
			};

			children = traverseWithPartialFlatten(
				ctx,
				childOptions,
				currentDepth + 1,
				newAncestors,
				newPath,
				warnings,
				flattenDepth
			);
		}

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

/**
 * Collect all descendants as a flat list (used by partial flatten)
 */
function collectDescendantsFlat(
	ctx: ExecutorContext,
	options: TraversalOptions,
	ancestorPaths: Set<string>,
	traversalPath: string[],
	warnings: QueryWarning[],
	currentDepth: number
): QueryResultNode[] {
	const {relation, maxDepth, pruneExpr} = options;

	if (currentDepth > maxDepth) {
		return [];
	}

	const sourcePath = traversalPath[traversalPath.length - 1]!;
	const edges = ctx.getOutgoingEdges(sourcePath, relation);
	const results: QueryResultNode[] = [];

	for (const edge of edges) {
		// Cycle detection
		if (ancestorPaths.has(edge.toPath)) {
			continue;
		}

		const props = ctx.getProperties(edge.toPath);
		const newPath = [...traversalPath, edge.toPath];

		// Build traversal context
		const traversalCtx: TraversalContext = {
			depth: currentDepth,
			relation: edge.relation,
			isImplied: edge.implied,
			parent: sourcePath,
			path: newPath,
		};

		// Apply PRUNE filter
		if (pruneExpr) {
			ctx.setCurrentFile(edge.toPath, props);
			ctx.setTraversal(traversalCtx);
			const pruneResult = pruneExpr.evaluate(ctx);
			if (ctx.isTruthy(pruneResult)) {
				continue;
			}
		}

		const visualDirection = ctx.getVisualDirection(edge.relation);

		// Add this node (with no children - flattened)
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
			children: [],
		});

		// Recursively collect descendants
		const newAncestors = new Set(ancestorPaths);
		newAncestors.add(edge.toPath);

		const descendants = collectDescendantsFlat(
			ctx, options, newAncestors, newPath, warnings, currentDepth + 1
		);
		results.push(...descendants);
	}

	return results;
}

/**
 * DFS traversal - returns tree structure of nodes
 */
function traverseRelation(
	ctx: ExecutorContext,
	options: TraversalOptions,
	currentDepth: number,
	ancestorPaths: Set<string>,
	traversalPath: string[],
	warnings: QueryWarning[]
): QueryResultNode[] {
	const {startPath, relation, maxDepth, extendGroup, pruneExpr, resolveGroup} = options;

	if (currentDepth > maxDepth) {
		// At leaf - check for extend
		if (extendGroup && resolveGroup) {
			return extendFromGroup(
				ctx,
				traversalPath[traversalPath.length - 1]!,
				extendGroup,
				ancestorPaths,
				traversalPath,
				warnings,
				pruneExpr,
				resolveGroup
			);
		}
		return [];
	}

	const sourcePath = traversalPath[traversalPath.length - 1]!;
	const edges = ctx.getOutgoingEdges(sourcePath, relation);
	const results: QueryResultNode[] = [];

	for (const edge of edges) {
		// Cycle detection (per-path)
		if (ancestorPaths.has(edge.toPath)) {
			continue;
		}

		const props = ctx.getProperties(edge.toPath);
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
		if (pruneExpr) {
			ctx.setCurrentFile(edge.toPath, props);
			ctx.setTraversal(traversalCtx);
			const pruneResult = pruneExpr.evaluate(ctx);
			if (ctx.isTruthy(pruneResult)) {
				continue; // Skip this node and its subtree
			}
		}

		const visualDirection = ctx.getVisualDirection(edge.relation);

		// Traverse children
		const newAncestors = new Set(ancestorPaths);
		newAncestors.add(edge.toPath);

		const childOptions: TraversalOptions = {
			...options,
			startPath: edge.toPath,
		};

		const children = traverseRelation(
			ctx,
			childOptions,
			currentDepth + 1,
			newAncestors,
			newPath,
			warnings
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

/**
 * Extend traversal from a group query
 */
function extendFromGroup(
	ctx: ExecutorContext,
	sourcePath: string,
	groupName: string,
	ancestorPaths: Set<string>,
	traversalPath: string[],
	warnings: QueryWarning[],
	pruneExpr?: ExprNode,
	resolveGroup?: (name: string) => TraversalOptions[] | undefined
): QueryResultNode[] {
	if (!resolveGroup) {
		warnings.push({message: `Cannot resolve group for extend: ${groupName}`});
		return [];
	}

	const groupRelations = resolveGroup(groupName);
	if (!groupRelations) {
		warnings.push({message: `Cannot resolve group for extend: ${groupName}`});
		return [];
	}

	const results: QueryResultNode[] = [];
	for (const relOptions of groupRelations) {
		const childOptions: TraversalOptions = {
			...relOptions,
			startPath: sourcePath,
			pruneExpr,
			resolveGroup,
		};

		const newAncestors = new Set(ancestorPaths);
		const nodes = traverseRelation(ctx, childOptions, 1, newAncestors, traversalPath, warnings);
		results.push(...nodes);
	}
	return results;
}
