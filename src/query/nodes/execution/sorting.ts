/**
 * Sorting logic for TQL query results
 */

import type {ExecutorContext} from "../context";
import type {QueryResultNode, Value} from "../types";
import type {SortKeyNode} from "../clauses/SortKeyNode";
import type {RelationEdge} from "../../../types";
import {buildChainStructure, getBasename, type ChainStructure} from "../../chain-sort";

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

	// Check if chain sorting is needed
	const hasChainKey = keys.some((k) => k.key === "chain");

	let sorted: QueryResultNode[];

	if (hasChainKey) {
		// Build chain structure for these siblings
		const sequentialRelations = ctx.getSequentialRelations();
		const nodePaths = new Set(nodes.map((n) => n.path));
		const edgesBySource = buildEdgeMapForNodes(nodes, ctx);
		const chainStructure = buildChainStructure(nodePaths, edgesBySource, sequentialRelations);

		// Sort with chain awareness
		sorted = sortWithChains(nodes, keys, chainStructure);
	} else {
		// Simple property-based sort
		sorted = [...nodes].sort((a, b) => compareNodes(a, b, keys));
	}

	// Sort children recursively
	return sorted.map((node) => ({
		...node,
		children: sortNodes(node.children, keys, ctx),
	}));
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
	nodes: QueryResultNode[],
	keys: SortKeyNode[],
	structure: ChainStructure
): QueryResultNode[] {
	const nodeByPath = new Map(nodes.map((n) => [n.path, n]));

	// Determine chain sort position in keys
	const chainKeyIndex = keys.findIndex((k) => k.key === "chain");
	const isChainPrimary = chainKeyIndex === 0;

	if (isChainPrimary || structure.chains.size === 0) {
		return sortChainsPrimary(nodes, keys, structure, nodeByPath);
	}

	return sortChainsSecondary(nodes, keys, structure, nodeByPath, chainKeyIndex);
}

/**
 * Chain sort primary: chains are kept intact, sorted by head's properties
 */
function sortChainsPrimary(
	_nodes: QueryResultNode[],
	keys: SortKeyNode[],
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
	sortKeys.sort((a, b) => compareNodes(a.node, b.node, nonChainKeys));

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
 * Chain sort secondary: property sort first, then chain sort within property groups
 */
function sortChainsSecondary(
	nodes: QueryResultNode[],
	keys: SortKeyNode[],
	structure: ChainStructure,
	nodeByPath: Map<string, QueryResultNode>,
	chainKeyIndex: number
): QueryResultNode[] {
	const keysBeforeChain = keys.slice(0, chainKeyIndex);

	// Sort all nodes by properties before chain key
	const sortedByProps = [...nodes].sort((a, b) => compareNodes(a, b, keysBeforeChain));

	if (keysBeforeChain.length === 0) {
		return sortChainsPrimary(nodes, keys, structure, nodeByPath);
	}

	// Group nodes by their primary sort key value
	const primaryKey = keysBeforeChain[0];
	if (!primaryKey || primaryKey.key === "chain") {
		return sortChainsPrimary(nodes, keys, structure, nodeByPath);
	}

	const groups = groupByPropertyValue(sortedByProps, primaryKey);

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
		const groupStructure = filterChainStructure(structure, groupPaths);

		if (groupStructure.chains.size === 0) {
			result.push(...group);
		} else {
			const groupNodeByPath = new Map(group.map((n) => [n.path, n]));
			result.push(...sortChainsPrimary(group, keysAfterChain, groupStructure, groupNodeByPath));
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
 * Group nodes by their value for a sort key
 */
function groupByPropertyValue(nodes: QueryResultNode[], key: SortKeyNode): QueryResultNode[][] {
	if (key.key === "chain") {
		return [nodes];
	}

	const groups = new Map<string, QueryResultNode[]>();
	const order: string[] = [];

	// Use getFrontmatterPath for proper handling of $file.properties.* syntax
	const propPath = key.key.getFrontmatterPath();
	if (!propPath) {
		// Can't group by file metadata - return all nodes as one group
		return [nodes];
	}

	for (const node of nodes) {
		const value = getPropertyValue(node.properties, propPath);
		const valueStr = value === null ? "" : String(value);

		if (!groups.has(valueStr)) {
			groups.set(valueStr, []);
			order.push(valueStr);
		}
		groups.get(valueStr)!.push(node);
	}

	return order.map((k) => groups.get(k)!);
}

/**
 * Compare two nodes for sorting
 */
function compareNodes(a: QueryResultNode, b: QueryResultNode, keys: SortKeyNode[]): number {
	for (const key of keys) {
		if (key.key === "chain") {
			continue;
		}

		// Use getFrontmatterPath for proper handling of $file.properties.* syntax
		const propPath = key.key.getFrontmatterPath();
		if (!propPath) {
			// Skip file metadata properties - they can't be accessed from node.properties
			continue;
		}
		
		const aVal = getPropertyValue(a.properties, propPath);
		const bVal = getPropertyValue(b.properties, propPath);
		let cmp = compareValues(aVal, bVal);

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

/**
 * Get property value from file properties.
 * Supports nested YAML properties via dot notation.
 * If nested traversal fails, tries the flat key as fallback.
 */
function getPropertyValue(props: Record<string, unknown>, path: string): Value {
	const parts = path.split(".");
	
	// First try nested traversal (prioritized for nested YAML)
	let current: unknown = props;
	for (const part of parts) {
		if (current === null || current === undefined) {
			break;
		}
		if (typeof current === "object" && current !== null) {
			current = (current as Record<string, unknown>)[part];
		} else {
			current = undefined;
			break;
		}
	}

	if (current !== undefined) {
		return current as Value;
	}

	// Fallback: try flat key if nested traversal failed
	if (parts.length > 1) {
		const flatValue = props[path];
		if (flatValue !== undefined) {
			return flatValue as Value;
		}
	}

	return null;
}
