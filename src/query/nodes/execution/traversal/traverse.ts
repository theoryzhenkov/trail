/**
 * Unified Graph Traversal
 *
 * Single traversal implementation that handles all output modes (tree, flat, partial flat).
 * The traversal:
 * 1. Walks the graph using DFS (or BFS for full flatten)
 * 2. Uses the filter to decide include/traverse for each node
 * 3. Uses the state to build results in the appropriate structure
 */

import type {ExecutorContext} from "../../context";
import type {QueryResultNode, TraversalContext} from "../../types";
import type {TraversalConfig, TraversalResult, NodeContext} from "./types";
import {TraversalState, BfsTraversalState} from "./state";

/**
 * Traverse a relation and return result nodes
 *
 * This is the main entry point for traversal. It dispatches to either
 * DFS (for tree and partial flatten) or BFS (for full flatten).
 */
export function traverse(ctx: ExecutorContext, config: TraversalConfig): TraversalResult {
	const {flattenFrom} = config.output;

	if (flattenFrom === true) {
		// Full flatten uses BFS for global deduplication
		return traverseBfs(ctx, config);
	}

	// Tree and partial flatten use DFS
	return traverseDfs(ctx, config);
}

// =============================================================================
// DFS Traversal (Tree and Partial Flatten)
// =============================================================================

/**
 * DFS traversal for tree and partial flatten modes
 */
function traverseDfs(ctx: ExecutorContext, config: TraversalConfig): TraversalResult {
	const state = new TraversalState(config);
	const nodes = visitChildren(ctx, config, state, 1);
	return state.getResult(nodes);
}

/**
 * Visit children of the current node
 */
function visitChildren(
	ctx: ExecutorContext,
	config: TraversalConfig,
	state: TraversalState,
	depth: number
): QueryResultNode[] {
	if (depth > config.maxDepth) {
		return [];
	}

	const sourcePath = state.currentPath();
	const edges = ctx.getOutgoingEdges(sourcePath, config.relation);
	const results: QueryResultNode[] = [];

	for (const edge of edges) {
		// Cycle detection
		if (state.isAncestor(edge.toPath)) {
			continue;
		}

		const result = visitNode(ctx, config, state, edge, depth);
		if (result) {
			results.push(result);
		}
	}

	// Handle leaf nodes (no edges found) for chain processing
	if (edges.length === 0 && config.onLeaf && state.getTraversalPath().length > 1) {
		const leafResults = handleLeaf(ctx, config, state, depth);
		results.push(...leafResults);
	}

	return results;
}

/**
 * Visit a single node
 */
function visitNode(
	ctx: ExecutorContext,
	config: TraversalConfig,
	state: TraversalState,
	edge: import("../../../../types").RelationEdge,
	depth: number
): QueryResultNode | null {
	const properties = ctx.getProperties(edge.toPath);
	const visualDirection = ctx.getVisualDirection(edge.relation);
	const nodeCtx = state.buildNodeContext(edge, depth, properties, visualDirection);

	// Apply filter
	const decision = config.filter.evaluate(nodeCtx);

	if (!decision.include && !decision.traverse) {
		// PRUNE: skip entirely
		return null;
	}

	// Enter node for traversal
	state.enterNode(edge.toPath);

	// Traverse children if allowed
	let children: QueryResultNode[] = [];
	if (decision.traverse && depth < config.maxDepth) {
		children = visitChildren(ctx, config, state, depth + 1);
	}

	// Handle leaf nodes (at depth limit or no children)
	const isLeaf = children.length === 0;
	if (isLeaf && config.onLeaf) {
		const leafChildren = config.onLeaf.handle(nodeCtx);
		children.push(...leafChildren);
	}

	// Exit node
	state.exitNode();

	if (!decision.include) {
		// WHERE-filtered: don't include but could return children for ancestor
		// For now, just skip (WHERE is applied post-traversal)
		return null;
	}

	return state.buildResultNode(nodeCtx, children);
}

/**
 * Handle leaf node when no edges found (for chain processing)
 */
function handleLeaf(
	ctx: ExecutorContext,
	config: TraversalConfig,
	state: TraversalState,
	depth: number
): QueryResultNode[] {
	if (!config.onLeaf) {
		return [];
	}

	// Build a synthetic context for the leaf
	const sourcePath = state.currentPath();
	const properties = ctx.getProperties(sourcePath);
	const visualDirection = ctx.getVisualDirection(config.relation);

	const traversalCtx: TraversalContext = {
		depth,
		relation: config.relation,
		isImplied: false,
		parent: state.getTraversalPath()[state.getTraversalPath().length - 2] ?? null,
		path: state.getTraversalPath(),
	};

	const nodeCtx: NodeContext = {
		path: sourcePath,
		edge: {
			fromPath: traversalCtx.parent ?? sourcePath,
			toPath: sourcePath,
			relation: config.relation,
			implied: false,
		},
		depth,
		parent: traversalCtx.parent ?? sourcePath,
		traversalPath: state.getTraversalPath(),
		properties,
		traversalCtx,
		visualDirection,
	};

	return config.onLeaf.handle(nodeCtx);
}

// =============================================================================
// BFS Traversal (Full Flatten)
// =============================================================================

/**
 * BFS traversal for full flatten mode
 *
 * Uses BFS to ensure global deduplication - each node appears exactly once
 * regardless of how many paths lead to it.
 */
function traverseBfs(ctx: ExecutorContext, config: TraversalConfig): TraversalResult {
	const state = new BfsTraversalState(config.startPath);

	// BFS queue: [path, actualDepth, parentPath, traversalPath]
	type QueueItem = {
		path: string;
		depth: number;
		parent: string;
		traversalPath: string[];
	};
	const queue: QueueItem[] = [];

	// Track leaf nodes for chain processing
	const leafNodes: NodeContext[] = [];

	// Initialize with direct neighbors
	const initialEdges = ctx.getOutgoingEdges(config.startPath, config.relation);
	for (const edge of initialEdges) {
		if (!state.hasVisited(edge.toPath)) {
			state.markVisited(edge.toPath);
			queue.push({
				path: edge.toPath,
				depth: 1,
				parent: config.startPath,
				traversalPath: [config.startPath, edge.toPath],
			});
		}
	}

	while (queue.length > 0) {
		const item = queue.shift()!;
		const {path, depth, parent, traversalPath} = item;

		const properties = ctx.getProperties(path);

		// Get edge for implied status
		const edges = ctx.getOutgoingEdges(parent, config.relation);
		const edge = edges.find((e) => e.toPath === path) ?? {
			fromPath: parent,
			toPath: path,
			relation: config.relation,
			implied: false,
		};

		const visualDirection = ctx.getVisualDirection(config.relation);

		// Build node context
		const traversalCtx: TraversalContext = {
			depth: 1, // Always 1 in flattened output
			relation: config.relation,
			isImplied: edge.implied,
			parent,
			path: traversalPath,
		};

		const nodeCtx: NodeContext = {
			path,
			edge,
			depth: 1, // Normalized for flatten
			parent,
			traversalPath,
			properties,
			traversalCtx,
			visualDirection,
		};

		// Apply filter
		const decision = config.filter.evaluate(nodeCtx);

		if (!decision.include && !decision.traverse) {
			// PRUNE: skip this node entirely
			continue;
		}

		if (decision.include) {
			// Add to results
			state.addResult({
				path,
				relation: config.relation,
				depth: 1,
				implied: edge.implied,
				impliedFrom: edge.impliedFrom,
				parent: config.startPath, // In flatten mode, parent is always start
				traversalPath,
				properties,
				displayProperties: [],
				visualDirection,
				hasFilteredAncestor: false,
				children: [],
			});
		}

		// Continue BFS if allowed and within depth
		let hasMoreEdges = false;
		if (decision.traverse && depth < config.maxDepth) {
			const nextEdges = ctx.getOutgoingEdges(path, config.relation);
			for (const nextEdge of nextEdges) {
				if (!state.hasVisited(nextEdge.toPath)) {
					hasMoreEdges = true;
					state.markVisited(nextEdge.toPath);
					queue.push({
						path: nextEdge.toPath,
						depth: depth + 1,
						parent: path,
						traversalPath: [...traversalPath, nextEdge.toPath],
					});
				}
			}
		}

		// Track leaf nodes for chain processing
		if (!hasMoreEdges && config.onLeaf) {
			leafNodes.push(nodeCtx);
		}
	}

	// Process chains at leaf nodes
	if (config.onLeaf && leafNodes.length > 0) {
		for (const leafCtx of leafNodes) {
			const chainResults = config.onLeaf.handle(leafCtx);
			for (const node of chainResults) {
				state.addResult(node);
			}
		}
	}

	return state.getResult();
}
