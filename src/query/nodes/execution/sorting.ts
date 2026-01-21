/**
 * Sorting logic for TQL query results
 *
 * Uses the standard evaluation pattern: set context for each node,
 * then call evaluate() on sort key expressions.
 */

import type {ExecutorContext} from "../context";
import type {QueryResultNode, Value} from "../types";
import type {SortKeyNode} from "../clauses/SortKeyNode";
import type {RelationEdge} from "../../../types";
import {buildChainStructure, getBasename, type ChainStructure} from "../../chain-sort";

/**
 * Node with pre-computed sort values
 */
interface SortableNode {
	node: QueryResultNode;
	values: Value[];
}

/**
 * Sort query result nodes based on sort keys
 */
export function sortNodes(
	nodes: QueryResultNode[],
	keys: SortKeyNode[],
	ctx: ExecutorContext
): QueryResultNode[] {
	if (nodes.length <= 1) {
		// Still need to sort children
		return nodes.map((node) => ({
			...node,
			children: sortNodes(node.children, keys, ctx),
		}));
	}

	// Pre-compute sort values for all nodes using evaluate()
	const sortables = prepareSortables(nodes, keys, ctx);

	// Check if chain sorting is needed
	const hasChainKey = keys.some((k) => k.key === "chain");

	let sorted: SortableNode[];

	if (hasChainKey) {
		// Build chain structure for these siblings
		const sequentialRelations = ctx.getSequentialRelations();
		const nodePaths = new Set(nodes.map((n) => n.path));
		const edgesBySource = buildEdgeMapForNodes(nodes, ctx);
		const chainStructure = buildChainStructure(nodePaths, edgesBySource, sequentialRelations);

		// Sort with chain awareness
		sorted = sortWithChains(sortables, keys, chainStructure);
	} else {
		// Simple property-based sort
		sorted = [...sortables].sort((a, b) => compareSortables(a, b, keys));
	}

	// Extract nodes and recursively sort children
	return sorted.map((s) => ({
		...s.node,
		children: sortNodes(s.node.children, keys, ctx),
	}));
}

/**
 * Pre-compute sort values for all nodes using the standard evaluation pattern.
 * Sets context for each node and calls evaluate() on sort key expressions.
 */
function prepareSortables(
	nodes: QueryResultNode[],
	keys: SortKeyNode[],
	ctx: ExecutorContext
): SortableNode[] {
	return nodes.map((node) => {
		// Set context to this node's file (standard pattern)
		ctx.setCurrentFile(node.path, node.properties);

		// Evaluate each sort key using PropertyNode.evaluate()
		const values = keys.map((key) => {
			if (key.key === "chain") return null;
			return key.key.evaluate(ctx);
		});

		return {node, values};
	});
}

/**
 * Build edge map for sibling nodes to detect chains
 */
function buildEdgeMapForNodes(
	nodes: QueryResultNode[],
	ctx: ExecutorContext
): Map<string, RelationEdge[]> {
	const edgeMap = new Map<string, RelationEdge[]>();
	for (const node of nodes) {
		const edges = ctx.getOutgoingEdges(node.path);
		edgeMap.set(node.path, edges);
	}
	return edgeMap;
}

/**
 * Sort nodes with chain awareness
 */
function sortWithChains(
	sortables: SortableNode[],
	keys: SortKeyNode[],
	structure: ChainStructure
): SortableNode[] {
	const sortableByPath = new Map(sortables.map((s) => [s.node.path, s]));

	// Determine chain sort position in keys
	const chainKeyIndex = keys.findIndex((k) => k.key === "chain");
	const isChainPrimary = chainKeyIndex === 0;

	if (isChainPrimary || structure.chains.size === 0) {
		return sortChainsPrimary(sortables, keys, structure, sortableByPath);
	}

	return sortChainsSecondary(sortables, keys, structure, sortableByPath, chainKeyIndex);
}

/**
 * Chain sort primary: chains are kept intact, sorted by head's properties
 */
function sortChainsPrimary(
	_sortables: SortableNode[],
	keys: SortKeyNode[],
	structure: ChainStructure,
	sortableByPath: Map<string, SortableNode>
): SortableNode[] {
	// Collect chain heads + disconnected nodes
	const heads: SortableNode[] = [];

	for (const head of structure.chains.keys()) {
		const sortable = sortableByPath.get(head);
		if (sortable) {
			heads.push(sortable);
		}
	}

	for (const path of structure.disconnected) {
		const sortable = sortableByPath.get(path);
		if (sortable) {
			heads.push(sortable);
		}
	}

	// Sort heads by properties (excluding chain key)
	heads.sort((a, b) => compareSortables(a, b, keys));

	// Expand: chain heads become full chains, disconnected stay as-is
	const result: SortableNode[] = [];

	for (const head of heads) {
		const chain = structure.chains.get(head.node.path);
		if (chain) {
			// This is a chain head - expand to full chain
			for (const path of chain) {
				const sortable = sortableByPath.get(path);
				if (sortable) {
					result.push(sortable);
				}
			}
		} else {
			// Disconnected node
			result.push(head);
		}
	}

	return result;
}

/**
 * Chain sort secondary: property sort first, then chain sort within property groups
 */
function sortChainsSecondary(
	sortables: SortableNode[],
	keys: SortKeyNode[],
	structure: ChainStructure,
	sortableByPath: Map<string, SortableNode>,
	chainKeyIndex: number
): SortableNode[] {
	const keysBeforeChain = keys.slice(0, chainKeyIndex);

	// Sort all nodes by properties before chain key
	const sortedByProps = [...sortables].sort((a, b) => compareSortables(a, b, keysBeforeChain));

	if (keysBeforeChain.length === 0) {
		return sortChainsPrimary(sortables, keys, structure, sortableByPath);
	}

	// Group nodes by their primary sort key value
	const groups = groupByValue(sortedByProps, chainKeyIndex - 1);

	// Apply chain sorting within each group
	const result: SortableNode[] = [];
	const keysAfterChain = keys.slice(chainKeyIndex + 1);

	for (const group of groups) {
		if (group.length <= 1) {
			result.push(...group);
			continue;
		}

		// Build chain structure for this subgroup
		const groupPaths = new Set(group.map((s) => s.node.path));
		const groupStructure = filterChainStructure(structure, groupPaths);

		if (groupStructure.chains.size === 0) {
			result.push(...group);
		} else {
			const groupSortableByPath = new Map(group.map((s) => [s.node.path, s]));
			result.push(...sortChainsPrimary(group, keysAfterChain, groupStructure, groupSortableByPath));
		}
	}

	return result;
}

/**
 * Filter chain structure to only include paths in the given set
 */
function filterChainStructure(structure: ChainStructure, paths: Set<string>): ChainStructure {
	const filteredChains = new Map<string, string[]>();
	const filteredDisconnected: string[] = [];
	const includedInChain = new Set<string>();

	for (const chain of structure.chains.values()) {
		const filteredChain = chain.filter((p) => paths.has(p));
		if (filteredChain.length > 1) {
			const newHead = filteredChain[0]!;
			filteredChains.set(newHead, filteredChain);
			filteredChain.forEach((p) => includedInChain.add(p));
		} else if (filteredChain.length === 1) {
			filteredDisconnected.push(filteredChain[0]!);
		}
	}

	for (const path of structure.disconnected) {
		if (paths.has(path)) {
			filteredDisconnected.push(path);
		}
	}

	for (const path of paths) {
		if (!includedInChain.has(path) && !filteredDisconnected.includes(path)) {
			filteredDisconnected.push(path);
		}
	}

	return {chains: filteredChains, disconnected: filteredDisconnected};
}

/**
 * Group sortables by their value at a specific key index
 */
function groupByValue(sortables: SortableNode[], keyIndex: number): SortableNode[][] {
	const groups = new Map<string, SortableNode[]>();
	const order: string[] = [];

	for (const sortable of sortables) {
		const value = sortable.values[keyIndex];
		const valueStr = value === null || value === undefined ? "" : String(value);

		if (!groups.has(valueStr)) {
			groups.set(valueStr, []);
			order.push(valueStr);
		}
		groups.get(valueStr)!.push(sortable);
	}

	return order.map((k) => groups.get(k)!);
}

/**
 * Compare two sortables using pre-computed values
 */
function compareSortables(a: SortableNode, b: SortableNode, keys: SortKeyNode[]): number {
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i]!;
		if (key.key === "chain") {
			continue;
		}

		const aVal = a.values[i] ?? null;
		const bVal = b.values[i] ?? null;
		let cmp = compareValues(aVal, bVal);

		if (key.direction === "desc") {
			cmp = -cmp;
		}

		if (cmp !== 0) {
			return cmp;
		}
	}

	// Fallback: alphabetical by basename
	return getBasename(a.node.path).localeCompare(getBasename(b.node.path));
}

/**
 * Compare two values for sorting
 */
function compareValues(a: Value, b: Value): number {
	if (a === null && b === null) return 0;
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
