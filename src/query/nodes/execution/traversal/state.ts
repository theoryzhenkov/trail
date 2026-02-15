/**
 * Traversal State Management
 *
 * The TraversalState class manages:
 * - Ancestor tracking for cycle detection
 * - Path tracking through the graph
 * - Result building (tree vs flat output)
 * - Warning collection
 */

import type {RelationEdge, FileProperties, VisualDirection} from "../../../../types";
import type {QueryResultNode, QueryWarning, TraversalContext} from "../../types";
import type {TraversalConfig, NodeContext, OutputConfig} from "./types";

/**
 * Manages traversal state and result building
 */
export class TraversalState {
	/** Paths of all ancestors (for cycle detection) */
	private readonly ancestors: Set<string>;
	/** Current traversal path from root */
	private readonly path: string[];
	/** Flat results (used when flattening) */
	private readonly flatResults: QueryResultNode[] = [];
	/** Collected warnings */
	private readonly warnings: QueryWarning[] = [];
	/** Output configuration */
	private readonly output: OutputConfig;
	/** The relation being traversed */
	private readonly relation: string;

	constructor(config: TraversalConfig) {
		this.ancestors = new Set([config.startPath]);
		this.path = [config.startPath];
		this.output = config.output;
		this.relation = config.relation;
	}

	// =========================================================================
	// Path & Cycle Management
	// =========================================================================

	/**
	 * Check if a path is an ancestor (would create a cycle)
	 */
	isAncestor(path: string): boolean {
		return this.ancestors.has(path);
	}

	/**
	 * Get the current path (last element of traversal path)
	 */
	currentPath(): string {
		return this.path[this.path.length - 1]!;
	}

	/**
	 * Get the full traversal path
	 */
	getTraversalPath(): string[] {
		return [...this.path];
	}

	/**
	 * Enter a node (add to path and ancestors)
	 */
	enterNode(nodePath: string): void {
		this.path.push(nodePath);
		this.ancestors.add(nodePath);
	}

	/**
	 * Exit a node (remove from path and ancestors)
	 */
	exitNode(): void {
		const removed = this.path.pop();
		if (removed) {
			this.ancestors.delete(removed);
		}
	}

	/**
	 * Create a snapshot of ancestors (for recursive calls that need isolation)
	 */
	snapshotAncestors(): Set<string> {
		return new Set(this.ancestors);
	}

	// =========================================================================
	// Node Context Building
	// =========================================================================

	/**
	 * Build context for a node being visited
	 */
	buildNodeContext(
		edge: RelationEdge,
		depth: number,
		properties: FileProperties,
		visualDirection: VisualDirection,
		relationName: string,
		impliedFromName?: string
	): NodeContext {
		const traversalPath = [...this.path, edge.toPath];

		const traversalCtx: TraversalContext = {
			depth,
			relation: relationName,
			isImplied: edge.implied,
			parent: this.currentPath(),
			path: traversalPath,
		};

		return {
			path: edge.toPath,
			edge,
			depth,
			parent: this.currentPath(),
			traversalPath,
			properties,
			traversalCtx,
			relationName,
			impliedFromName,
			visualDirection,
		};
	}

	// =========================================================================
	// Result Building
	// =========================================================================

	/**
	 * Build a result node from context and children
	 *
	 * Handles output configuration:
	 * - Tree mode: returns node with children nested
	 * - Flat mode: adds to flat results, returns node without children
	 * - Partial flat: tree until flattenFrom depth, then flat
	 */
	buildResultNode(ctx: NodeContext, children: QueryResultNode[]): QueryResultNode {
		const {flattenFrom} = this.output;

		const node: QueryResultNode = {
			path: ctx.path,
			relation: ctx.relationName,
			depth: ctx.depth,
			implied: ctx.edge.implied,
			impliedFrom: ctx.impliedFromName,
			parent: ctx.parent,
			traversalPath: ctx.traversalPath,
			properties: ctx.properties,
			displayProperties: [],
			visualDirection: ctx.visualDirection,
			hasFilteredAncestor: false,
			children: [],
		};

		if (flattenFrom === true) {
			// Full flatten: all nodes collected flat, depth normalized to 1
			node.depth = 1;
			node.children = [];
			this.flatResults.push(node);
		} else if (typeof flattenFrom === "number" && ctx.depth >= flattenFrom) {
			// At or beyond flatten depth: flatten this node and all children
			node.children = [];
			this.flatResults.push(node);
			// Flatten children recursively
			this.flattenChildren(children);
		} else {
			// Tree mode: nest children normally
			node.children = children;
		}

		return node;
	}

	/**
	 * Recursively flatten children into flatResults
	 */
	private flattenChildren(children: QueryResultNode[]): void {
		for (const child of children) {
			const flattened: QueryResultNode = {
				...child,
				children: [],
			};
			this.flatResults.push(flattened);
			this.flattenChildren(child.children);
		}
	}

	// =========================================================================
	// Warnings
	// =========================================================================

	/**
	 * Add a warning
	 */
	addWarning(message: string): void {
		this.warnings.push({message});
	}

	// =========================================================================
	// Result Finalization
	// =========================================================================

	/**
	 * Get the final result based on output configuration
	 */
	getResult(treeResults: QueryResultNode[]): {nodes: QueryResultNode[]; warnings: QueryWarning[]} {
		const {flattenFrom} = this.output;

		if (flattenFrom === true) {
			// Full flatten: return flat results
			return {nodes: this.flatResults, warnings: this.warnings};
		}

		if (typeof flattenFrom === "number") {
			// Partial flatten: tree results contain nodes up to flattenFrom,
			// with flattened children in flatResults
			// The tree results already have correct structure from buildResultNode
			return {nodes: treeResults, warnings: this.warnings};
		}

		// Tree mode: return tree results
		return {nodes: treeResults, warnings: this.warnings};
	}
}

/**
 * State for BFS traversal (used for full flatten mode)
 */
export class BfsTraversalState {
	/** Visited paths (for deduplication) */
	private readonly visited: Set<string>;
	/** Flat results */
	private readonly results: QueryResultNode[] = [];
	/** Collected warnings */
	private readonly warnings: QueryWarning[] = [];
	/** Starting path */
	private readonly startPath: string;

	constructor(startPath: string) {
		this.visited = new Set([startPath]);
		this.startPath = startPath;
	}

	/**
	 * Check if a path has been visited
	 */
	hasVisited(path: string): boolean {
		return this.visited.has(path);
	}

	/**
	 * Mark a path as visited
	 */
	markVisited(path: string): void {
		this.visited.add(path);
	}

	/**
	 * Add a result node
	 */
	addResult(node: QueryResultNode): void {
		this.results.push(node);
	}

	/**
	 * Add a warning
	 */
	addWarning(message: string): void {
		this.warnings.push({message});
	}

	/**
	 * Get the starting path
	 */
	getStartPath(): string {
		return this.startPath;
	}

	/**
	 * Get the final result
	 */
	getResult(): {nodes: QueryResultNode[]; warnings: QueryWarning[]} {
		return {nodes: this.results, warnings: this.warnings};
	}
}
