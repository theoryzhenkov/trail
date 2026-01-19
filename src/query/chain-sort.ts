/**
 * Chain sorting utilities for TQL executor
 * Ported from sibling-sort.ts to support sequential relations in TQL queries
 */

import type {RelationEdge, FileProperties} from "../types";

/**
 * Structure representing chains among sibling nodes
 */
export interface ChainStructure {
	/** Map from chain head path to ordered list of paths in the chain */
	chains: Map<string, string[]>;
	/** Paths not part of any chain */
	disconnected: string[];
}

/**
 * A node that can be chain-sorted (minimal interface for both GroupTreeNode and QueryResultNode)
 */
export interface ChainSortableNode {
	path: string;
	properties: FileProperties;
	children: ChainSortableNode[];
}

/**
 * Builds chain structure by detecting sequential relation edges among siblings.
 * 
 * @param nodePaths Set of sibling node paths to analyze
 * @param edgesBySource Map from source path to outgoing edges
 * @param sequentialRelations Set of relation names that are sequential (e.g., "next", "prev")
 * @returns Chain structure with identified chains and disconnected nodes
 */
export function buildChainStructure(
	nodePaths: Set<string>,
	edgesBySource: Map<string, RelationEdge[]>,
	sequentialRelations: Set<string>
): ChainStructure {
	// Build adjacency map: path -> next path (via sequential relation)
	const nextMap = new Map<string, string>();

	for (const path of nodePaths) {
		const edges = edgesBySource.get(path) ?? [];
		for (const edge of edges) {
			if (sequentialRelations.has(edge.relation) && nodePaths.has(edge.toPath)) {
				nextMap.set(path, edge.toPath);
				break; // One next per node
			}
		}
	}

	// If no edges between siblings, all are disconnected
	if (nextMap.size === 0) {
		return {
			chains: new Map(),
			disconnected: Array.from(nodePaths)
		};
	}

	// Find chain heads: nodes that have outgoing but no incoming edges from siblings
	const hasIncoming = new Set(nextMap.values());
	const chainMembers = new Set([...nextMap.keys(), ...nextMap.values()]);

	// Build chains by following from heads
	const chains = new Map<string, string[]>();
	const visited = new Set<string>();

	// Find heads (in chain but no incoming)
	const heads = Array.from(chainMembers).filter((path) => !hasIncoming.has(path));

	// Handle cycles: if no heads found but there are chain members, pick alphabetically first
	if (heads.length === 0 && chainMembers.size > 0) {
		const cyclePaths = Array.from(chainMembers).sort((a, b) =>
			getBasename(a).localeCompare(getBasename(b))
		);
		const firstCyclePath = cyclePaths[0];
		if (firstCyclePath) {
			heads.push(firstCyclePath);
		}
	}

	// Build chains from each head
	for (const head of heads) {
		if (visited.has(head)) {
			continue;
		}

		const chain: string[] = [];
		let current: string | undefined = head;

		while (current && !visited.has(current)) {
			chain.push(current);
			visited.add(current);
			current = nextMap.get(current);
		}

		if (chain.length > 0) {
			chains.set(head, chain);
		}
	}

	// Disconnected nodes: not part of any chain
	const disconnected = Array.from(nodePaths).filter((path) => !visited.has(path));

	return {chains, disconnected};
}

/**
 * Gets the position of a path within the chain structure.
 * Returns null if the path is not in any chain.
 */
export function getChainPosition(path: string, structure: ChainStructure): number | null {
	for (const chain of structure.chains.values()) {
		const index = chain.indexOf(path);
		if (index !== -1) {
			return index;
		}
	}
	return null;
}

/**
 * Gets the chain head for a given path.
 * Returns null if the path is not in any chain.
 */
export function getChainHead(path: string, structure: ChainStructure): string | null {
	for (const [head, chain] of structure.chains) {
		if (chain.includes(path)) {
			return head;
		}
	}
	return null;
}

/**
 * Extracts basename from a file path.
 */
export function getBasename(path: string): string {
	const parts = path.split("/");
	const filename = parts[parts.length - 1] ?? path;
	// Remove .md extension for comparison
	return filename.replace(/\.md$/, "");
}

/**
 * Builds an edge map from source paths to outgoing edges.
 * Used by the executor to prepare data for chain sorting.
 */
export function buildEdgeMap(
	getOutgoingEdges: (path: string) => RelationEdge[],
	paths: string[]
): Map<string, RelationEdge[]> {
	const edgeMap = new Map<string, RelationEdge[]>();
	for (const path of paths) {
		edgeMap.set(path, getOutgoingEdges(path));
	}
	return edgeMap;
}
