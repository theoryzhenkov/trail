import type {GroupTreeNode} from "../graph/store";
import type {QueryResultNode} from "../query/result";
import type {DisplayGroup, GroupMember} from "../types";

/**
 * Converts a tree of GroupTreeNode into nested DisplayGroups.
 * Groups siblings by relation, merges subgroups when children are identical,
 * splits into labeled subgroups when children diverge.
 */
export function treeToGroups(nodes: GroupTreeNode[]): DisplayGroup[] {
	if (nodes.length === 0) return [];
	
	// Group nodes by relation
	const byRelation = new Map<string, GroupTreeNode[]>();
	for (const node of nodes) {
		const list = byRelation.get(node.relation) ?? [];
		list.push(node);
		byRelation.set(node.relation, list);
	}
	
	const groups: DisplayGroup[] = [];
	for (const [relation, relationNodes] of byRelation) {
		groups.push(createGroupFromNodes(relation, relationNodes));
	}
	
	return groups;
}

/**
 * Creates a DisplayGroup from nodes that share the same relation.
 */
function createGroupFromNodes(relation: string, nodes: GroupTreeNode[]): DisplayGroup {
	// Create members from nodes
	const members: GroupMember[] = nodes.map(node => ({
		path: node.path,
		relation: node.relation,
		implied: node.implied,
		impliedFrom: node.impliedFrom,
		properties: node.properties ?? {}
	}));
	
	// Collect children from all nodes
	const childrenByNode = nodes.map(node => node.children);
	const allChildrenEmpty = childrenByNode.every(c => c.length === 0);
	
	if (allChildrenEmpty) {
		return { relation, members, subgroups: [] };
	}
	
	// Check if all nodes have identical children subtrees
	const allIdentical = childrenSetsEqual(childrenByNode);
	
	let subgroups: DisplayGroup[];
	if (allIdentical && childrenByNode[0]) {
		// Merge: all children become a single set of subgroups
		subgroups = treeToGroups(childrenByNode[0]);
	} else if (!allIdentical) {
		// Split: create separate labeled subgroups per parent node
		subgroups = [];
		for (const node of nodes) {
			if (node.children.length > 0) {
				const nodeSubgroups = treeToGroups(node.children);
				// Label subgroups with the parent node's name
				const parentName = getBasename(node.path);
				for (const subgroup of nodeSubgroups) {
					subgroups.push({
						...subgroup,
						label: `${parentName}'s ${subgroup.relation}`
					});
				}
			}
		}
	} else {
		subgroups = [];
	}
	
	return { relation, members, subgroups };
}

/**
 * Checks if multiple arrays of children are structurally equal.
 */
function childrenSetsEqual(sets: GroupTreeNode[][]): boolean {
	if (sets.length <= 1) return true;
	const first = sets[0];
	if (!first) return true;
	for (let i = 1; i < sets.length; i++) {
		const current = sets[i];
		if (!current || !subtreesEqual(first, current)) return false;
	}
	return true;
}

/**
 * Compares two subtrees for structural equality.
 * Two subtrees are equal if they have the same paths and their children are also equal.
 */
export function subtreesEqual(a: GroupTreeNode[], b: GroupTreeNode[]): boolean {
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
		if (!subtreesEqual(nodeA.children, nodeB.children)) return false;
	}
	return true;
}

/**
 * Extracts the basename (filename without extension) from a path.
 */
function getBasename(path: string): string {
	const parts = path.split("/");
	const filename = parts[parts.length - 1] ?? path;
	return filename.replace(/\.md$/, "");
}

/**
 * Converts a tree of QueryResultNode into nested DisplayGroups.
 * TQL-specific version that handles QueryResultNode fields.
 */
export function tqlTreeToGroups(nodes: QueryResultNode[]): DisplayGroup[] {
	if (nodes.length === 0) return [];
	
	// Group nodes by relation
	const byRelation = new Map<string, QueryResultNode[]>();
	for (const node of nodes) {
		const list = byRelation.get(node.relation) ?? [];
		list.push(node);
		byRelation.set(node.relation, list);
	}
	
	const groups: DisplayGroup[] = [];
	for (const [relation, relationNodes] of byRelation) {
		groups.push(createTqlGroupFromNodes(relation, relationNodes));
	}
	
	return groups;
}

/**
 * Creates a DisplayGroup from TQL nodes that share the same relation.
 */
function createTqlGroupFromNodes(relation: string, nodes: QueryResultNode[]): DisplayGroup {
	// Create members from nodes
	const members: GroupMember[] = nodes.map(node => ({
		path: node.path,
		relation: node.relation,
		implied: node.implied,
		impliedFrom: node.impliedFrom,
		properties: node.properties
	}));
	
	// Collect children from all nodes
	const childrenByNode = nodes.map(node => node.children);
	const allChildrenEmpty = childrenByNode.every(c => c.length === 0);
	
	if (allChildrenEmpty) {
		return { relation, members, subgroups: [] };
	}
	
	// Check if all nodes have identical children subtrees
	const allIdentical = tqlChildrenSetsEqual(childrenByNode);
	
	let subgroups: DisplayGroup[];
	if (allIdentical && childrenByNode[0]) {
		// Merge: all children become a single set of subgroups
		subgroups = tqlTreeToGroups(childrenByNode[0]);
	} else if (!allIdentical) {
		// Split: create separate labeled subgroups per parent node
		subgroups = [];
		for (const node of nodes) {
			if (node.children.length > 0) {
				const nodeSubgroups = tqlTreeToGroups(node.children);
				// Label subgroups with the parent node's name
				const parentName = getBasename(node.path);
				for (const subgroup of nodeSubgroups) {
					subgroups.push({
						...subgroup,
						label: `${parentName}'s ${subgroup.relation}`
					});
				}
			}
		}
	} else {
		subgroups = [];
	}
	
	return { relation, members, subgroups };
}

/**
 * Checks if multiple arrays of TQL children are structurally equal.
 */
function tqlChildrenSetsEqual(sets: QueryResultNode[][]): boolean {
	if (sets.length <= 1) return true;
	const first = sets[0];
	if (!first) return true;
	for (let i = 1; i < sets.length; i++) {
		const current = sets[i];
		if (!current || !tqlSubtreesEqual(first, current)) return false;
	}
	return true;
}

/**
 * Compares two TQL subtrees for structural equality.
 */
function tqlSubtreesEqual(a: QueryResultNode[], b: QueryResultNode[]): boolean {
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

// Legacy functions below - kept for backward compatibility during migration

/**
 * @deprecated Use treeToGroups instead
 * Inverts a tree chain so the deepest node becomes the root.
 * Parent -> Grandparent becomes Grandparent -> Parent
 */
export function invertTree(nodes: GroupTreeNode[]): GroupTreeNode[] {
	const result: GroupTreeNode[] = [];
	for (const node of nodes) {
		result.push(...invertChain(node));
	}
	return result;
}

/**
 * @deprecated Use treeToGroups instead
 * Inverts a single chain: collects all nodes, rebuilds with reversed parent/child.
 * The loop makes the last-processed item the root, so iterating shallow→deep
 * produces a deep→shallow chain.
 */
function invertChain(node: GroupTreeNode): GroupTreeNode[] {
	// Collect all nodes in the chain (depth-first, following first child)
	const chain: GroupTreeNode[] = [];
	let current: GroupTreeNode | undefined = node;
	while (current) {
		chain.push(current);
		current = current.children[0];
	}
	
	if (chain.length <= 1) {
		return [{ ...node, children: [] }];
	}
	
	// Build inverted chain: iterate shallow→deep, last processed becomes root
	// [Parent, Grandparent] → Grandparent{children:[Parent{children:[]}]}
	let result: GroupTreeNode | undefined;
	for (const item of chain) {
		const newNode: GroupTreeNode = {
			...item,
			children: result ? [result] : []
		};
		result = newNode;
	}
	
	return result ? [result] : [];
}

/**
 * Flattens a tree into a flat array of siblings (no children).
 */
export function flattenTree(nodes: GroupTreeNode[]): GroupTreeNode[] {
	const result: GroupTreeNode[] = [];
	for (const node of nodes) {
		result.push({ ...node, children: [] });
		if (node.children.length > 0) {
			result.push(...flattenTree(node.children));
		}
	}
	return result;
}

/**
 * Inverts TQL result tree chains so the deepest node becomes the root.
 */
export function invertTqlTree(nodes: QueryResultNode[]): QueryResultNode[] {
	const result: QueryResultNode[] = [];
	for (const node of nodes) {
		result.push(...invertTqlChain(node));
	}
	return result;
}

function invertTqlChain(node: QueryResultNode): QueryResultNode[] {
	const chain: QueryResultNode[] = [];
	let current: QueryResultNode | undefined = node;
	while (current) {
		chain.push(current);
		current = current.children[0];
	}
	
	if (chain.length <= 1) {
		return [{ ...node, children: [] }];
	}
	
	let result: QueryResultNode | undefined;
	for (const item of chain) {
		const newNode: QueryResultNode = {
			...item,
			children: result ? [result] : []
		};
		result = newNode;
	}
	
	return result ? [result] : [];
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
