import type { QueryResultNode } from "../query/nodes/types";
import type { DisplayGroup, GroupMember } from "../types";

/**
 * Node with merged relations from multiple traversals.
 * When the same file is reached via different relations, the instances
 * are merged into a single node with all relations collected.
 */
interface MergedNode {
	path: string;
	relations: string[];
	implied: boolean;
	impliedFrom?: string;
	properties: QueryResultNode["properties"];
	displayProperties: QueryResultNode["displayProperties"];
	visualDirection: QueryResultNode["visualDirection"];
	children: MergedNode[];
}

/**
 * Converts a tree of QueryResultNode into nested DisplayGroups.
 *
 * First merges nodes that share the same path (reached via multiple relations)
 * into single entries, then groups by identical relation sets and subtrees.
 */
export function tqlTreeToGroups(nodes: QueryResultNode[]): DisplayGroup[] {
	if (nodes.length === 0) return [];
	const merged = mergeNodesByPath(nodes);
	return groupMergedNodes(merged);
}

// =============================================================================
// Merge: deduplicate nodes reached via multiple relations
// =============================================================================

/**
 * Merge sibling nodes that share the same path.
 * Collects all unique relations, unions children, and recurses.
 * Preserves order of first appearance.
 */
function mergeNodesByPath(nodes: QueryResultNode[]): MergedNode[] {
	const byPath = new Map<string, QueryResultNode[]>();
	const order: string[] = [];

	for (const node of nodes) {
		if (!byPath.has(node.path)) {
			byPath.set(node.path, []);
			order.push(node.path);
		}
		byPath.get(node.path)!.push(node);
	}

	return order.map((path) => {
		const instances = byPath.get(path)!;
		const first = instances[0]!;

		// Collect unique relations (with label suffix), sorted for stable comparison
		const relations = [
			...new Set(
				instances.map((n) =>
					n.label ? `${n.relation}.${n.label}` : n.relation,
				),
			),
		].sort();

		// If any instance is explicit (not implied), the merged node is explicit
		const implied = instances.every((n) => n.implied);
		const impliedFrom = implied ? first.impliedFrom : undefined;

		// Union children from all instances, then recursively merge
		const allChildren = instances.flatMap((n) => n.children);
		const children = mergeNodesByPath(allChildren);

		return {
			path,
			relations,
			implied,
			impliedFrom,
			properties: first.properties,
			displayProperties: first.displayProperties,
			visualDirection: first.visualDirection,
			children,
		};
	});
}

// =============================================================================
// Group: cluster nodes with identical relation sets and subtrees
// =============================================================================

/**
 * Group merged nodes by relation set and identical subtrees.
 * Can group non-adjacent nodes with matching structure.
 */
function groupMergedNodes(nodes: MergedNode[]): DisplayGroup[] {
	if (nodes.length === 0) return [];

	const groups: DisplayGroup[] = [];
	const used = new Set<number>();

	for (let i = 0; i < nodes.length; i++) {
		if (used.has(i)) continue;

		const node = nodes[i];
		if (!node) continue;

		const matchingNodes: MergedNode[] = [node];
		used.add(i);

		for (let j = i + 1; j < nodes.length; j++) {
			if (used.has(j)) continue;
			const other = nodes[j];
			if (!other) continue;

			if (
				arraysEqual(other.relations, node.relations) &&
				mergedSubtreesEqual(node.children, other.children)
			) {
				matchingNodes.push(other);
				used.add(j);
			}
		}

		groups.push(createGroupFromMergedNodes(matchingNodes));
	}

	return groups;
}

/**
 * Creates a DisplayGroup from merged nodes that have identical subtrees.
 */
function createGroupFromMergedNodes(nodes: MergedNode[]): DisplayGroup {
	const firstNode = nodes[0];
	if (!firstNode) {
		return { relations: [], members: [], subgroups: [] };
	}

	const relations = firstNode.relations;

	const members: GroupMember[] = nodes.map((node) => ({
		path: node.path,
		relations: node.relations,
		implied: node.implied,
		impliedFrom: node.impliedFrom,
		properties: node.properties,
		displayProperties: node.displayProperties.map((dp) => ({
			key: dp.key,
			value: dp.value as GroupMember["displayProperties"][number]["value"],
		})),
	}));

	// Since all nodes have identical children, process first node's children
	const subgroups = groupMergedNodes(firstNode.children);

	return { relations, members, subgroups };
}

// =============================================================================
// Comparison helpers
// =============================================================================

/**
 * Compares two sorted string arrays for equality.
 */
function arraysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/**
 * Compares two merged subtrees for structural equality.
 */
function mergedSubtreesEqual(a: MergedNode[], b: MergedNode[]): boolean {
	if (a.length !== b.length) return false;
	if (a.length === 0) return true;

	const sortedA = [...a].sort((x, y) => x.path.localeCompare(y.path));
	const sortedB = [...b].sort((x, y) => x.path.localeCompare(y.path));

	for (let i = 0; i < sortedA.length; i++) {
		const nodeA = sortedA[i];
		const nodeB = sortedB[i];
		if (!nodeA || !nodeB) return false;
		if (nodeA.path !== nodeB.path) return false;
		if (!mergedSubtreesEqual(nodeA.children, nodeB.children)) return false;
	}
	return true;
}

/**
 * Compares two QueryResultNode subtrees for structural equality.
 * Exported for testing.
 */
export function tqlSubtreesEqual(
	a: QueryResultNode[],
	b: QueryResultNode[],
): boolean {
	if (a.length !== b.length) return false;
	if (a.length === 0) return true;

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

// =============================================================================
// Inversion (for ascending view)
// =============================================================================

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
	parentAsChild: DisplayGroup | null,
): DisplayGroup[] {
	const invertedGroup: DisplayGroup = {
		...group,
		subgroups: parentAsChild ? [parentAsChild] : [],
	};

	if (group.subgroups.length === 0) {
		return [invertedGroup];
	}

	const roots: DisplayGroup[] = [];
	for (const subgroup of group.subgroups) {
		roots.push(...invertDisplayGroupChain(subgroup, invertedGroup));
	}
	return roots;
}
