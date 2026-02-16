/**
 * Unified Graph Traversal
 *
 * Single traversal implementation that handles all output modes (tree, flat, partial flat).
 * The traversal:
 * 1. Walks the graph using DFS (or BFS for full flatten)
 * 2. Uses the filter to decide include/traverse for each node
 * 3. Uses the state to build results in the appropriate structure
 *
 * @see docs/concepts/traversal.md
 */

import type { RelationEdge } from "../../../../types";
import type { QueryEnv } from "../../context";
import type { QueryResultNode, TraversalContext } from "../../types";
import type { TraversalConfig, TraversalResult, NodeContext } from "./types";
import { TraversalState, BfsTraversalState } from "./state";

/**
 * Traverse a relation and return result nodes
 *
 * This is the main entry point for traversal. It dispatches to either
 * DFS (for tree and partial flatten) or BFS (for full flatten).
 */
export function traverse(
	env: QueryEnv,
	config: TraversalConfig,
): TraversalResult {
	const { flattenFrom } = config.output;

	if (flattenFrom === true) {
		// Full flatten uses BFS for global deduplication
		return traverseBfs(env, config);
	}

	// Tree and partial flatten use DFS
	return traverseDfs(env, config);
}

// =============================================================================
// Shared Node Processing
// =============================================================================

/**
 * Resolve an edge into a NodeContext with all display metadata.
 * Shared by DFS (via TraversalState.buildNodeContext), BFS, and handleLeaf.
 */
export function resolveNodeContext(
	env: QueryEnv,
	edge: RelationEdge,
	depth: number,
	parent: string,
	traversalPath: string[],
): NodeContext {
	const properties = env.getProperties(edge.toPath);
	const visualDirection = env.getVisualDirection(edge.relationUid);
	const relationName = env.getRelationName(edge.relationUid);
	const impliedFromName = edge.impliedFromUid
		? env.getRelationName(edge.impliedFromUid)
		: undefined;

	const traversalCtx: TraversalContext = {
		depth,
		relation: relationName,
		label: edge.label,
		isImplied: edge.implied,
		parent,
		path: traversalPath,
	};

	return {
		path: edge.toPath,
		edge,
		depth,
		parent,
		traversalPath,
		properties,
		traversalCtx,
		relationName,
		impliedFromName,
		visualDirection,
	};
}

// =============================================================================
// DFS Traversal (Tree and Partial Flatten)
// =============================================================================

/**
 * DFS traversal for tree and partial flatten modes
 */
function traverseDfs(env: QueryEnv, config: TraversalConfig): TraversalResult {
	const state = new TraversalState(config);
	const nodes = visitChildren(env, config, state, 1, undefined);
	return state.getResult(nodes);
}

/**
 * Visit children of the current node
 *
 * @param incomingEdge - The edge that brought us to the current node (for leaf handling).
 *                       Undefined at the root level.
 */
function visitChildren(
	env: QueryEnv,
	config: TraversalConfig,
	state: TraversalState,
	depth: number,
	incomingEdge: RelationEdge | undefined,
): QueryResultNode[] {
	if (depth > config.maxDepth) {
		return [];
	}

	const sourcePath = state.currentPath();
	const relationUid = env.resolveRelationUid(config.relation);
	if (!relationUid) {
		return [];
	}
	const edges = env.getOutgoingEdges(sourcePath, relationUid, config.label);
	const results: QueryResultNode[] = [];

	for (const edge of edges) {
		// Cycle detection
		if (state.isAncestor(edge.toPath)) {
			continue;
		}

		const result = visitNode(env, config, state, edge, depth);
		if (result) {
			results.push(result);
		}
	}

	// Handle leaf nodes (no edges found) for chain processing
	// Fix 5B: Pass the real incoming edge instead of fabricating one
	if (
		edges.length === 0 &&
		config.onLeaf &&
		state.getTraversalPath().length > 1
	) {
		const leafResults = handleLeaf(env, config, state, depth, incomingEdge);
		results.push(...leafResults);
	}

	return results;
}

/**
 * Visit a single node
 */
function visitNode(
	env: QueryEnv,
	config: TraversalConfig,
	state: TraversalState,
	edge: RelationEdge,
	depth: number,
): QueryResultNode | null {
	const nodeCtx = state.buildNodeContext(env, edge, depth);

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
		children = visitChildren(env, config, state, depth + 1, edge);
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
 *
 * Fix 5B: Uses the real incoming edge when available instead of fabricating one.
 */
function handleLeaf(
	env: QueryEnv,
	config: TraversalConfig,
	state: TraversalState,
	depth: number,
	incomingEdge: RelationEdge | undefined,
): QueryResultNode[] {
	if (!config.onLeaf) {
		return [];
	}

	const sourcePath = state.currentPath();
	const properties = env.getProperties(sourcePath);
	const relationUid = env.resolveRelationUid(config.relation);
	if (!relationUid) {
		return [];
	}
	const relationName = env.getRelationName(relationUid);
	const visualDirection = env.getVisualDirection(relationUid);

	// Use the real incoming edge's implied status if available
	const isImplied = incomingEdge?.implied ?? false;
	const impliedFromName = incomingEdge?.impliedFromUid
		? env.getRelationName(incomingEdge.impliedFromUid)
		: undefined;

	const traversalCtx: TraversalContext = {
		depth,
		relation: relationName,
		label: incomingEdge?.label,
		isImplied,
		parent:
			state.getTraversalPath()[state.getTraversalPath().length - 2] ??
			null,
		path: state.getTraversalPath(),
	};

	const nodeCtx: NodeContext = {
		path: sourcePath,
		edge: incomingEdge ?? {
			fromPath: traversalCtx.parent ?? sourcePath,
			toPath: sourcePath,
			relationUid,
			label: config.label,
			implied: false,
		},
		depth,
		parent: traversalCtx.parent ?? sourcePath,
		traversalPath: state.getTraversalPath(),
		properties,
		traversalCtx,
		relationName,
		impliedFromName,
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
 *
 * Refactored to use resolveNodeContext for shared node processing (5A).
 */
function traverseBfs(env: QueryEnv, config: TraversalConfig): TraversalResult {
	const state = new BfsTraversalState(config.startPath);
	const relationUid = env.resolveRelationUid(config.relation);
	if (!relationUid) {
		return state.getResult();
	}
	const relationName = env.getRelationName(relationUid);

	type QueueItem = {
		edge: RelationEdge;
		depth: number;
		parent: string;
		traversalPath: string[];
	};
	const queue: QueueItem[] = [];

	// Track leaf nodes for chain processing
	const leafNodes: NodeContext[] = [];

	// Initialize with direct neighbors
	const initialEdges = env.getOutgoingEdges(
		config.startPath,
		relationUid,
		config.label,
	);
	for (const edge of initialEdges) {
		if (!state.hasVisited(edge.toPath)) {
			state.markVisited(edge.toPath);
			queue.push({
				edge,
				depth: 1,
				parent: config.startPath,
				traversalPath: [config.startPath, edge.toPath],
			});
		}
	}

	while (queue.length > 0) {
		const item = queue.shift()!;
		const { edge, depth, parent, traversalPath } = item;

		// Use shared node context resolution
		const nodeCtx = resolveNodeContext(env, edge, 1, parent, traversalPath);

		// Apply filter
		const decision = config.filter.evaluate(nodeCtx);

		if (!decision.include && !decision.traverse) {
			// PRUNE: skip this node entirely
			continue;
		}

		if (decision.include) {
			// Add to results
			const visualDirection = env.getVisualDirection(relationUid);
			state.addResult({
				path: edge.toPath,
				relation: relationName,
				label: edge.label,
				depth: 1,
				implied: edge.implied,
				impliedFrom: nodeCtx.impliedFromName,
				parent: config.startPath, // In flatten mode, parent is always start
				traversalPath,
				properties: nodeCtx.properties,
				displayProperties: [],
				visualDirection,
				hasFilteredAncestor: false,
				children: [],
			});
		}

		// Continue BFS if allowed and within depth
		let hasMoreEdges = false;
		if (decision.traverse && depth < config.maxDepth) {
			const nextEdges = env.getOutgoingEdges(
				edge.toPath,
				relationUid,
				config.label,
			);
			for (const nextEdge of nextEdges) {
				if (!state.hasVisited(nextEdge.toPath)) {
					hasMoreEdges = true;
					state.markVisited(nextEdge.toPath);
					queue.push({
						edge: nextEdge,
						depth: depth + 1,
						parent: edge.toPath,
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
