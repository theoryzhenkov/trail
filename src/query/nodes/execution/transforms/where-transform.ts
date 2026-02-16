/**
 * WHERE Transform
 *
 * Post-traversal filter that removes nodes not matching the WHERE expression.
 * Children of filtered nodes are promoted to maintain graph connectivity.
 */

import type {QueryTransform} from "../pipeline";
import type {QueryEnv} from "../../context";
import {evalContextFromNode} from "../../context";
import type {WhereNode} from "../../clauses/WhereNode";
import type {QueryResultNode} from "../../types";

export class WhereTransform implements QueryTransform {
	constructor(private readonly where: WhereNode) {}

	apply(nodes: QueryResultNode[], env: QueryEnv): QueryResultNode[] {
		return applyWhereFilter(nodes, this.where, env);
	}
}

function applyWhereFilter(
	nodes: QueryResultNode[],
	where: WhereNode,
	env: QueryEnv
): QueryResultNode[] {
	const result: QueryResultNode[] = [];

	for (const node of nodes) {
		const nodeCtx = evalContextFromNode(env, node);
		const filteredChildren = applyWhereFilter(node.children, where, env);

		if (where.test(nodeCtx)) {
			result.push({...node, children: filteredChildren});
		} else if (filteredChildren.length > 0) {
			result.push(...filteredChildren.map((child) => ({...child, hasFilteredAncestor: true})));
		}
	}

	return result;
}
