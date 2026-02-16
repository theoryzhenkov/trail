/**
 * Traversal Types
 *
 * Core interfaces for the traversal system. The traversal is designed with
 * separation of concerns:
 * - Filtering: decides which nodes to include/traverse (PRUNE, WHERE, future filters)
 * - Output: controls result structure (tree vs flat)
 * - Traversal: single implementation that walks the graph
 */

import type {
	RelationEdge,
	FileProperties,
	VisualDirection,
} from "../../../../types";
import type {
	TraversalContext,
	QueryResultNode,
	QueryWarning,
} from "../../types";

// =============================================================================
// Node Context - Information about the current node during traversal
// =============================================================================

/**
 * Context provided to filters and builders for the current node
 */
export interface NodeContext {
	/** Path of the current file */
	path: string;
	/** Edge that led to this node */
	edge: RelationEdge;
	/** Current traversal depth (1-indexed) */
	depth: number;
	/** Parent node path */
	parent: string;
	/** Full path from root to current node */
	traversalPath: string[];
	/** File properties for this node */
	properties: FileProperties;
	/** Traversal context for expression evaluation */
	traversalCtx: TraversalContext;
	/** Resolved display relation name */
	relationName: string;
	/** Resolved display implied-from relation name */
	impliedFromName?: string;
	/** Visual direction of the relation */
	visualDirection: VisualDirection;
}

// =============================================================================
// Filtering - Composable filters for node inclusion/traversal
// =============================================================================

/**
 * Result of filter evaluation
 */
export interface FilterDecision {
	/** Whether to include this node in output */
	include: boolean;
	/** Whether to traverse into children */
	traverse: boolean;
}

/**
 * Filter interface - evaluates whether to include/traverse nodes
 *
 * Filters are composed by the executor from PRUNE, WHERE, and other clauses.
 * The traversal calls this once per node to decide how to handle it.
 */
export interface NodeFilter {
	/**
	 * Evaluate whether to include/traverse a node
	 * @param ctx Node context with all available information
	 * @returns Decision on how to handle the node
	 */
	evaluate(ctx: NodeContext): FilterDecision;
}

/**
 * Always-include filter (no filtering)
 */
export const INCLUDE_ALL: NodeFilter = {
	evaluate: () => ({ include: true, traverse: true }),
};

// =============================================================================
// Output Configuration - Controls result structure
// =============================================================================

/**
 * Output configuration controlling result structure
 *
 * - undefined/null: Tree output with nested children
 * - true: Flat output, all nodes at depth 1 with no children
 * - number: Tree until depth N, then flatten children
 */
export interface OutputConfig {
	/**
	 * Flatten mode:
	 * - undefined: normal tree structure
	 * - true: flatten all (BFS-like, all at depth 1)
	 * - number: flatten from depth N (tree until N, then flat)
	 */
	flattenFrom?: number | true;
}

// =============================================================================
// Traversal Configuration
// =============================================================================

/**
 * Configuration for a traversal operation
 */
export interface TraversalConfig {
	/** Starting file path */
	startPath: string;
	/** Relation to traverse */
	relation: string;
	/** Optional label filter (e.g., "author" from up.author) */
	label?: string;
	/** Maximum depth (Infinity for unlimited) */
	maxDepth: number;
	/** Filter for node inclusion/traversal (composed by executor) */
	filter: NodeFilter;
	/** Output configuration (tree vs flat) */
	output: OutputConfig;
	/** Handler for leaf nodes (chain/extend processing) */
	onLeaf?: LeafHandler;
	/** Initial ancestors for cycle detection across chain boundaries (5C fix) */
	initialAncestors?: Set<string>;
}

/**
 * Handler for leaf nodes (nodes with no further edges or at depth limit)
 * Used for chain/extend processing
 */
export interface LeafHandler {
	/**
	 * Handle a leaf node, potentially returning additional nodes from chains
	 * @param ctx Node context for the leaf
	 * @returns Additional nodes to add (from chain traversal)
	 */
	handle(ctx: NodeContext): QueryResultNode[];
}

// =============================================================================
// Traversal Result
// =============================================================================

/**
 * Result of a traversal operation
 */
export interface TraversalResult {
	/** Result nodes (tree or flat depending on output config) */
	nodes: QueryResultNode[];
	/** Warnings generated during traversal */
	warnings: QueryWarning[];
}
