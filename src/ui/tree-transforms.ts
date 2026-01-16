import type {GroupTreeNode} from "../graph/store";

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
 * Inverts a single chain: collects all nodes, reverses, rebuilds as chain.
 */
function invertChain(node: GroupTreeNode): GroupTreeNode[] {
	// Collect all nodes in the chain (depth-first, following first child)
	const chain: GroupTreeNode[] = [];
	let current: GroupTreeNode | undefined = node;
	while (current) {
		chain.push(current);
		// Follow the chain (first child), collect siblings separately
		current = current.children[0];
	}
	
	if (chain.length <= 1) {
		return [{ ...node, children: [] }];
	}
	
	// Reverse and rebuild as a chain
	chain.reverse();
	
	// Build the inverted chain from deepest to shallowest
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
