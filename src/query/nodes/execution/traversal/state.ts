/**
 * Traversal State Management
 *
 * The TraversalState class manages:
 * - Ancestor tracking for cycle detection
 * - Path tracking through the graph
 * - Result building (tree vs flat output)
 * - Warning collection
 */

import type { RelationEdge } from "../../../../types";
import type { QueryEnv } from "../../context";
import type { QueryResultNode, QueryWarning } from "../../types";
import type { TraversalConfig, NodeContext, OutputConfig } from "./types";
import { resolveNodeContext } from "./traverse";

/**
 * Manages traversal state and result building
 */
export class TraversalState {
	/** Paths of all ancestors (for cycle detection) */
	private readonly ancestors: Set<string>;
	/** Current traversal path from root */
	private readonly path: string[];
	/** Collected warnings */
	private readonly warnings: QueryWarning[] = [];
	/** Output configuration */
	private readonly output: OutputConfig;
	/** The relation being traversed */
	private readonly relation: string;

	constructor(config: TraversalConfig) {
		// Fix 5C: Merge initial ancestors from chain boundaries
		this.ancestors = new Set([config.startPath]);
		if (config.initialAncestors) {
			for (const ancestor of config.initialAncestors) {
				this.ancestors.add(ancestor);
			}
		}
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

	// =========================================================================
	// Node Context Building
	// =========================================================================

	/**
	 * Build context for a node being visited.
	 * Delegates to the shared resolveNodeContext, providing state-derived
	 * parent and traversalPath.
	 */
	buildNodeContext(
		env: QueryEnv,
		edge: RelationEdge,
		depth: number,
	): NodeContext {
		return resolveNodeContext(env, edge, depth, this.currentPath(), [
			...this.path,
			edge.toPath,
		]);
	}

	// =========================================================================
	// Result Building
	// =========================================================================

	/**
	 * Build a result node from context and children
	 *
	 * Handles output configuration:
	 * - Tree mode: returns node with children nested
	 * - Partial flat: tree until flattenFrom depth, then flatten descendants
	 */
	buildResultNode(
		ctx: NodeContext,
		children: QueryResultNode[],
	): QueryResultNode {
		const { flattenFrom } = this.output;

		const node: QueryResultNode = {
			path: ctx.path,
			relation: ctx.relationName,
			label: ctx.edge.label,
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

		if (typeof flattenFrom === "number" && ctx.depth >= flattenFrom) {
			// Fix 5D: At or beyond flatten depth, flatten all descendants
			// as direct children instead of discarding them
			node.children = flattenDescendants(children);
		} else {
			// Tree mode: nest children normally
			node.children = children;
		}

		return node;
	}

	// =========================================================================
	// Warnings
	// =========================================================================

	/**
	 * Add a warning
	 */
	addWarning(message: string): void {
		this.warnings.push({ message });
	}

	// =========================================================================
	// Result Finalization
	// =========================================================================

	/**
	 * Get the final result based on output configuration
	 */
	getResult(treeResults: QueryResultNode[]): {
		nodes: QueryResultNode[];
		warnings: QueryWarning[];
	} {
		// Both tree and partial flatten are now handled entirely in buildResultNode
		return { nodes: treeResults, warnings: this.warnings };
	}
}

/**
 * Recursively flatten descendants into a single-level list
 */
function flattenDescendants(nodes: QueryResultNode[]): QueryResultNode[] {
	const result: QueryResultNode[] = [];
	for (const node of nodes) {
		result.push({ ...node, children: [] });
		if (node.children.length > 0) {
			result.push(...flattenDescendants(node.children));
		}
	}
	return result;
}

/**
 * State for BFS traversal (used for full flatten mode)
 */
export class BfsTraversalState {
	/** Visited paths (for deduplication) */
	private readonly visited: Set<string>;
	/** Flat results */
	private readonly results: QueryResultNode[] = [];

	constructor(startPath: string) {
		this.visited = new Set([startPath]);
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
	 * Get the final result
	 */
	getResult(): { nodes: QueryResultNode[]; warnings: QueryWarning[] } {
		return { nodes: this.results, warnings: [] };
	}
}
