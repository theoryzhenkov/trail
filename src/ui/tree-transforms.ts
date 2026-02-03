import type {QueryResultNode, Value} from "../query/nodes/types";
import type {DisplayGroup, GroupMember} from "../types";

/**
 * Converts a tree of QueryResultNode into nested DisplayGroups.
 *
 * Uses sort-key-aware grouping:
 * 1. Partition nodes into CONSECUTIVE RUNS with equal partition key values
 * 2. Within each partition:
 *    - Chained nodes (hasChainSort + isChained): consecutive-only grouping
 *    - Disconnected or no chain: full grouping (can group non-adjacent nodes)
 */
export function tqlTreeToGroups(nodes: QueryResultNode[]): DisplayGroup[] {
	if (nodes.length === 0) return [];

	// Partition nodes into consecutive runs with equal partition key values
	const partitions = partitionByKeyValues(nodes);

	const groups: DisplayGroup[] = [];

	for (const partition of partitions) {
		// Check if this partition contains chained nodes
		const isChainedPartition = partition.some(
			(n) => n.sortInfo?.hasChainSort && n.sortInfo?.isChained
		);

		if (isChainedPartition) {
			// Chained: consecutive-only grouping (chain position matters)
			groups.push(...groupConsecutive(partition));
		} else {
			// Disconnected or no :chain: full grouping
			groups.push(...groupFull(partition));
		}
	}

	return groups;
}

/**
 * Partition nodes into CONSECUTIVE RUNS with equal partition key values.
 * Preserves sort order - no reordering.
 */
function partitionByKeyValues(nodes: QueryResultNode[]): QueryResultNode[][] {
	const partitions: QueryResultNode[][] = [];
	let current: QueryResultNode[] = [];

	for (const node of nodes) {
		if (
			current.length === 0 ||
			partitionKeysEqual(
				current[0]?.sortInfo?.partitionKeyValues,
				node.sortInfo?.partitionKeyValues
			)
		) {
			current.push(node);
		} else {
			partitions.push(current);
			current = [node];
		}
	}

	if (current.length > 0) {
		partitions.push(current);
	}

	return partitions;
}

/**
 * Compare two partition key value arrays for equality.
 */
function partitionKeysEqual(a: Value[] | undefined, b: Value[] | undefined): boolean {
	// No sortInfo means all nodes have same partition (backward compatible)
	if (!a && !b) return true;
	if (!a || !b) return false;
	if (a.length !== b.length) return false;

	for (let i = 0; i < a.length; i++) {
		const aVal = a[i];
		const bVal = b[i];
		// Type guard: i < a.length && i < b.length (since lengths are equal)
		if (aVal === undefined || bVal === undefined) return false;
		if (!valuesEqual(aVal, bVal)) {
			return false;
		}
	}

	return true;
}

/**
 * Compare two values for equality.
 */
function valuesEqual(a: Value, b: Value): boolean {
	if (a === b) return true;
	if (a === null || b === null) return a === b;

	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			const aItem = a[i];
			const bItem = b[i];
			// Type guard: i < a.length && i < b.length (since lengths are equal)
			if (aItem === undefined || bItem === undefined) return false;
			if (!valuesEqual(aItem, bItem)) return false;
		}
		return true;
	}

	return a === b;
}

/**
 * Consecutive-only grouping: only group adjacent nodes with same relation and subtrees.
 * Preserves chain order - does not pull later items forward.
 */
function groupConsecutive(nodes: QueryResultNode[]): DisplayGroup[] {
	if (nodes.length === 0) return [];

	const groups: DisplayGroup[] = [];
	let currentGroup: QueryResultNode[] = [];

	for (const node of nodes) {
		if (currentGroup.length === 0) {
			currentGroup.push(node);
			continue;
		}

		const first = currentGroup[0]!;
		// Check if this node can be grouped with current group
		if (
			node.relation === first.relation &&
			tqlSubtreesEqual(node.children, first.children)
		) {
			currentGroup.push(node);
		} else {
			// Finalize current group and start new one
			groups.push(createTqlGroupFromIdenticalNodes(currentGroup));
			currentGroup = [node];
		}
	}

	// Finalize last group
	if (currentGroup.length > 0) {
		groups.push(createTqlGroupFromIdenticalNodes(currentGroup));
	}

	return groups;
}

/**
 * Full grouping: can group any nodes with same relation and subtrees (original behavior).
 * Used for property-sorted partitions where ties are arbitrary.
 */
function groupFull(nodes: QueryResultNode[]): DisplayGroup[] {
	if (nodes.length === 0) return [];

	const groups: DisplayGroup[] = [];
	const used = new Set<number>();

	for (let i = 0; i < nodes.length; i++) {
		if (used.has(i)) continue;

		const node = nodes[i];
		if (!node) continue;

		const matchingNodes: QueryResultNode[] = [node];
		used.add(i);

		// Find other nodes with same relation AND identical subtrees
		for (let j = i + 1; j < nodes.length; j++) {
			if (used.has(j)) continue;
			const other = nodes[j];
			if (!other) continue;

			if (
				other.relation === node.relation &&
				tqlSubtreesEqual(node.children, other.children)
			) {
				matchingNodes.push(other);
				used.add(j);
			}
		}

		// Create group from nodes with identical subtrees
		groups.push(createTqlGroupFromIdenticalNodes(matchingNodes));
	}

	return groups;
}

/**
 * Creates a DisplayGroup from TQL nodes that have identical subtrees.
 */
function createTqlGroupFromIdenticalNodes(nodes: QueryResultNode[]): DisplayGroup {
	const firstNode = nodes[0];
	if (!firstNode) {
		return { relation: "", members: [], subgroups: [] };
	}
	
	const relation = firstNode.relation;
	
	// Create members from all nodes, including pre-computed display properties
	const members: GroupMember[] = nodes.map(node => ({
		path: node.path,
		relation: node.relation,
		implied: node.implied,
		impliedFrom: node.impliedFrom,
		properties: node.properties,
		displayProperties: node.displayProperties.map(dp => ({
			key: dp.key,
			value: dp.value as GroupMember["displayProperties"][number]["value"],
		})),
	}));
	
	// Since all nodes have identical children, process first node's children
	const subgroups = tqlTreeToGroups(firstNode.children);
	
	return { relation, members, subgroups };
}

/**
 * Compares two TQL subtrees for structural equality.
 * Two subtrees are equal if they have the same paths and their children are also equal.
 */
export function tqlSubtreesEqual(a: QueryResultNode[], b: QueryResultNode[]): boolean {
	if (a.length !== b.length) return false;
	if (a.length === 0) return true;
	
	// Sort by path for consistent comparison
	const sortedA = [...a].sort((x, y) => x.path.localeCompare(y.path));
	const sortedB = [...b].sort((x, y) => x.path.localeCompare(y.path));
	
	for (let i = 0; i < sortedA.length; i++) {
		const nodeA = sortedA[i];
		const nodeB = sortedB[i];
		if (!nodeA || !nodeB) return false;
		if (nodeA.path !== nodeB.path) return false;
		if (!tqlSubtreesEqual(nodeA.children, nodeB.children)) return false;
	}
	return true;
}

/**
 * Inverts DisplayGroups hierarchy for ascending view.
 * Deepest groups become roots, their parents become children.
 * Example: Dad -> [Grandma, Grandpa] becomes [Grandma, Grandpa] -> Dad
 */
export function invertDisplayGroups(groups: DisplayGroup[]): DisplayGroup[] {
	const result: DisplayGroup[] = [];
	for (const group of groups) {
		result.push(...invertDisplayGroupChain(group, null));
	}
	return result;
}

/**
 * Recursively inverts a single group chain.
 * @param group The current group being processed
 * @param parentAsChild The parent group (to become this group's child in inverted tree)
 */
function invertDisplayGroupChain(
	group: DisplayGroup, 
	parentAsChild: DisplayGroup | null
): DisplayGroup[] {
	// Create this group with parent as its subgroup (instead of original subgroups)
	const invertedGroup: DisplayGroup = {
		...group,
		subgroups: parentAsChild ? [parentAsChild] : []
	};
	
	if (group.subgroups.length === 0) {
		// Leaf node - this becomes a root in the inverted tree
		return [invertedGroup];
	}
	
	// Recurse into subgroups, passing this group as their child
	const roots: DisplayGroup[] = [];
	for (const subgroup of group.subgroups) {
		roots.push(...invertDisplayGroupChain(subgroup, invertedGroup));
	}
	return roots;
}

/**
 * Flattens TQL result tree into a flat array of siblings.
 */
export function flattenTqlTree(nodes: QueryResultNode[]): QueryResultNode[] {
	const result: QueryResultNode[] = [];
	for (const node of nodes) {
		result.push({ ...node, children: [] });
		if (node.children.length > 0) {
			result.push(...flattenTqlTree(node.children));
		}
	}
	return result;
}
