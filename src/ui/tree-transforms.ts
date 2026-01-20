import type {QueryResultNode} from "../query/nodes/types";
import type {DisplayGroup, GroupMember} from "../types";

/**
 * Converts a tree of QueryResultNode into nested DisplayGroups.
 * Only groups nodes together if they have the same relation AND identical subtrees.
 * Nodes with different children become separate groups.
 */
export function tqlTreeToGroups(nodes: QueryResultNode[]): DisplayGroup[] {
	if (nodes.length === 0) return [];
	
	// Partition nodes into groups: same relation AND identical subtrees
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
			
			if (other.relation === node.relation && 
			    tqlSubtreesEqual(node.children, other.children)) {
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
	
	// Create members from all nodes
	const members: GroupMember[] = nodes.map(node => ({
		path: node.path,
		relation: node.relation,
		implied: node.implied,
		impliedFrom: node.impliedFrom,
		properties: node.properties
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
