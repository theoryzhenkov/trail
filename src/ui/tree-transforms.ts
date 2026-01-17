import type {GroupTreeNode} from "../graph/store";
import type {QueryResultNode} from "../query/result";

/**
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
