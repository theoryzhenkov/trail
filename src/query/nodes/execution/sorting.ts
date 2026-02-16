/**
 * Sorting logic for TQL query results
 *
 * Constructs a fresh EvalContext per node, then calls evaluate()
 * on sort key expressions.
 */

import {evalContextFromNode} from "../context";
import type {QueryEnv} from "../context";
import type {QueryResultNode, Value} from "../types";
import type {SortKeyNode} from "../clauses/SortKeyNode";
import {compare} from "../value-ops";

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
	env: QueryEnv
): QueryResultNode[] {
	if (nodes.length <= 1) {
		return nodes.map((node) => ({
			...node,
			children: sortNodes(node.children, keys, env),
		}));
	}

	// Pre-compute sort values for all nodes
	const sortables = prepareSortables(nodes, keys, env);

	// Sort by pre-computed values
	const sorted = [...sortables].sort((a, b) => compareSortables(a, b, keys));

	// Extract nodes and recursively sort children
	return sorted.map((s) => ({
		...s.node,
		children: sortNodes(s.node.children, keys, env),
	}));
}

/**
 * Pre-compute sort values for all nodes.
 * Constructs a fresh EvalContext per node and calls evaluate() on sort key expressions.
 */
function prepareSortables(
	nodes: QueryResultNode[],
	keys: SortKeyNode[],
	env: QueryEnv
): SortableNode[] {
	return nodes.map((node) => {
		const ctx = evalContextFromNode(env, node);
		const values = keys.map((key) => key.key.evaluate(ctx));
		return {node, values};
	});
}

/**
 * Compare two sortables using pre-computed values
 */
function compareSortables(a: SortableNode, b: SortableNode, keys: SortKeyNode[]): number {
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i]!;
		const aVal = a.values[i] ?? null;
		const bVal = b.values[i] ?? null;
		let cmp = compare(aVal, bVal);

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
 * Extracts basename from a file path (without .md extension)
 */
function getBasename(path: string): string {
	const parts = path.split("/");
	const filename = parts[parts.length - 1] ?? path;
	return filename.replace(/\.md$/, "");
}
