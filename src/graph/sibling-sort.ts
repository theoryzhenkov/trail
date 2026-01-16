import type {ChainSortMode, PropertySortKey, RelationEdge} from "../types";
import type {GroupTreeNode} from "./store";

export interface SortConfig {
	sortBy: PropertySortKey[];
	chainSort: ChainSortMode;
	sequentialRelations: Set<string>;
	relationOrder: string[];
}

interface ChainStructure {
	chains: Map<string, string[]>; // headPath -> [path1, path2, ...]
	disconnected: string[]; // paths not in any chain
}

/**
 * Sorts sibling nodes based on the provided configuration.
 * Supports property-based sorting, chain sorting, and combinations thereof.
 */
export function sortSiblings(
	nodes: GroupTreeNode[],
	edgesBySource: Map<string, RelationEdge[]>,
	config: SortConfig
): GroupTreeNode[] {
	if (nodes.length <= 1) {
		return nodes;
	}

	const {sortBy, chainSort, sequentialRelations, relationOrder} = config;

	// Chain sort disabled: pure property/alphabetical sort
	if (chainSort === "disabled") {
		return sortByPropertiesThenAlphabetically(nodes, sortBy, relationOrder);
	}

	// Build chain structure if we have sequential relations
	const nodePaths = new Set(nodes.map((n) => n.path));
	const structure = sequentialRelations.size > 0
		? buildChainStructure(nodePaths, edgesBySource, sequentialRelations)
		: {chains: new Map<string, string[]>(), disconnected: Array.from(nodePaths)};

	// No chains found: pure property/alphabetical sort
	if (structure.chains.size === 0) {
		return sortByPropertiesThenAlphabetically(nodes, sortBy, relationOrder);
	}

	// Chain sort primary: chains first, property sort for ordering chains and disconnected
	if (chainSort === "primary") {
		return sortWithChainsPrimary(nodes, structure, sortBy, relationOrder);
	}

	// Chain sort secondary: property sort first, chains within same property groups
	return sortWithChainsSecondary(nodes, structure, sortBy, edgesBySource, sequentialRelations, relationOrder);
}

/**
 * Recursively sorts children of nodes using the provided configuration.
 */
export function sortSiblingsRecursively(
	nodes: GroupTreeNode[],
	edgesBySource: Map<string, RelationEdge[]>,
	config: SortConfig
): GroupTreeNode[] {
	const sorted = sortSiblings(nodes, edgesBySource, config);

	for (const node of sorted) {
		if (node.children.length > 0) {
			node.children = sortSiblingsRecursively(node.children, edgesBySource, config);
		}
	}

	return sorted;
}

/**
 * Chain sort primary: chains are kept intact, sorted by head's properties.
 * Disconnected nodes are interleaved based on their properties.
 */
function sortWithChainsPrimary(
	nodes: GroupTreeNode[],
	structure: ChainStructure,
	sortBy: PropertySortKey[],
	relationOrder: string[]
): GroupTreeNode[] {
	const nodeByPath = new Map(nodes.map((n) => [n.path, n]));

	// Collect sort keys: chain heads + disconnected
	const sortKeys: Array<{path: string; isChainHead: boolean; node: GroupTreeNode}> = [];

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

	// Sort by properties, then relation order, then alphabetically
	sortKeys.sort((a, b) => compareNodes(a.node, b.node, sortBy, relationOrder));

	// Expand: chain heads become full chains, disconnected stay as-is
	const result: GroupTreeNode[] = [];

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
function sortWithChainsSecondary(
	nodes: GroupTreeNode[],
	structure: ChainStructure,
	sortBy: PropertySortKey[],
	edgesBySource: Map<string, RelationEdge[]>,
	sequentialRelations: Set<string>,
	relationOrder: string[]
): GroupTreeNode[] {
	// First, sort all nodes by properties
	const sortedByProps = sortByPropertiesThenAlphabetically(nodes, sortBy, relationOrder);

	// If no sortBy keys, just apply chain sorting
	if (sortBy.length === 0) {
		return sortWithChainsPrimary(nodes, structure, sortBy, relationOrder);
	}

	// Group nodes by their primary sort key value
	const primarySortKey = sortBy[0];
	if (!primarySortKey) {
		return sortWithChainsPrimary(nodes, structure, sortBy, relationOrder);
	}
	const groups = groupByPropertyValue(sortedByProps, primarySortKey);

	// Apply chain sorting within each group
	const result: GroupTreeNode[] = [];
	for (const group of groups) {
		if (group.length <= 1) {
			result.push(...group);
			continue;
		}

		// Build chain structure for this subgroup
		const groupPaths = new Set(group.map((n) => n.path));
		const groupStructure = buildChainStructure(groupPaths, edgesBySource, sequentialRelations);

		if (groupStructure.chains.size === 0) {
			// No chains in this group, keep property-sorted order
			result.push(...group);
		} else {
			// Apply chain sorting within this property group
			const remainingSortBy = sortBy.slice(1);
			result.push(...sortWithChainsPrimary(group, groupStructure, remainingSortBy, relationOrder));
		}
	}

	return result;
}

/**
 * Groups nodes by their value for the first sort key.
 */
function groupByPropertyValue(nodes: GroupTreeNode[], sortKey: PropertySortKey): GroupTreeNode[][] {
	const groups = new Map<string, GroupTreeNode[]>();
	const order: string[] = [];

	for (const node of nodes) {
		const value = getPropertySortValue(node, sortKey.property);
		if (!groups.has(value)) {
			groups.set(value, []);
			order.push(value);
		}
		groups.get(value)!.push(node);
	}

	return order.map((key) => groups.get(key)!);
}

/**
 * Sorts nodes by properties, then relation, then alphabetically as fallback.
 */
function sortByPropertiesThenAlphabetically(
	nodes: GroupTreeNode[],
	sortBy: PropertySortKey[],
	relationOrder: string[]
): GroupTreeNode[] {
	return [...nodes].sort((a, b) => compareNodes(a, b, sortBy, relationOrder));
}

/**
 * Unified comparison function: properties → relation → alphabetical.
 * Groups nodes by relation type as a lower priority than property sorting.
 * Relation order is determined by settings order, not alphabetically.
 */
function compareNodes(
	a: GroupTreeNode,
	b: GroupTreeNode,
	sortBy: PropertySortKey[],
	relationOrder: string[]
): number {
	// 1. Compare by property sort keys (highest priority)
	const propCompare = compareByProperties(a, b, sortBy);
	if (propCompare !== 0) {
		return propCompare;
	}

	// 2. Compare by relation order from settings (groups same relations together)
	const aIndex = relationOrder.indexOf(a.relation);
	const bIndex = relationOrder.indexOf(b.relation);
	// Relations not in settings go to the end, sorted alphabetically
	const aOrder = aIndex === -1 ? relationOrder.length : aIndex;
	const bOrder = bIndex === -1 ? relationOrder.length : bIndex;
	if (aOrder !== bOrder) {
		return aOrder - bOrder;
	}
	// Both not in settings: fallback to alphabetical for relation names
	if (aIndex === -1 && bIndex === -1 && a.relation !== b.relation) {
		return a.relation.localeCompare(b.relation);
	}

	// 3. Compare by basename (alphabetical fallback)
	return getBasename(a.path).localeCompare(getBasename(b.path));
}

/**
 * Compares two nodes by multiple property sort keys.
 */
function compareByProperties(
	a: GroupTreeNode,
	b: GroupTreeNode,
	sortKeys: PropertySortKey[]
): number {
	for (const key of sortKeys) {
		const aRaw = getRawPropertyValue(a, key.property);
		const bRaw = getRawPropertyValue(b, key.property);

		// Missing values sort to end
		const aEmpty = aRaw === null;
		const bEmpty = bRaw === null;

		if (aEmpty && !bEmpty) {
			return 1;
		}
		if (!aEmpty && bEmpty) {
			return -1;
		}
		if (aEmpty && bEmpty) {
			continue;
		}

		const comparison = compareValues(aRaw, bRaw);
		if (comparison !== 0) {
			return key.direction === "desc" ? -comparison : comparison;
		}
	}

	return 0;
}

/**
 * Gets a raw property value from a node for sorting.
 * Returns null for missing/empty values.
 */
function getRawPropertyValue(node: GroupTreeNode, property: string): string | number | null {
	const value = node.properties?.[property];

	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === "number") {
		return value;
	}

	if (typeof value === "string") {
		return value || null;
	}

	if (Array.isArray(value)) {
		return value.length > 0 ? value[0] ?? null : null;
	}

	// Booleans: convert to string
	return String(value);
}

/**
 * Compares two values, handling numeric vs string comparison appropriately.
 * Numbers are compared numerically, strings lexicographically.
 * Mixed types: numbers sort before strings.
 */
function compareValues(a: string | number | null, b: string | number | null): number {
	// Both null handled by caller, but be safe
	if (a === null && b === null) return 0;
	if (a === null) return 1;
	if (b === null) return -1;

	const aIsNum = typeof a === "number";
	const bIsNum = typeof b === "number";

	// Both numbers: numeric comparison
	if (aIsNum && bIsNum) {
		return a - b;
	}

	// Both strings: try numeric parsing first for numeric strings
	if (!aIsNum && !bIsNum) {
		const aNum = parseFloat(a);
		const bNum = parseFloat(b);
		// Both parse as valid numbers: compare numerically
		if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
			return aNum - bNum;
		}
		// Otherwise lexicographic
		return a.localeCompare(b);
	}

	// Mixed: numbers sort before strings
	return aIsNum ? -1 : 1;
}

/**
 * Gets a property value as string (for grouping by property value).
 */
function getPropertySortValue(node: GroupTreeNode, property: string): string {
	const value = getRawPropertyValue(node, property);
	if (value === null) return "";
	return String(value);
}

/**
 * Builds chain structure by detecting sequential relation edges among siblings.
 */
function buildChainStructure(
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
 * Extracts basename from a file path.
 */
function getBasename(path: string): string {
	const parts = path.split("/");
	const filename = parts[parts.length - 1] ?? path;
	// Remove .md extension for comparison
	return filename.replace(/\.md$/, "");
}
