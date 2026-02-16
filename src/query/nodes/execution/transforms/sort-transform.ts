/**
 * SORT Transform
 *
 * Sorts result nodes by sort key expressions.
 * Delegates to the existing sortNodes function which now correctly
 * uses evalContextFromNode (includes traversal context).
 */

import type {QueryTransform} from "../pipeline";
import type {QueryEnv} from "../../context";
import type {SortNode} from "../../clauses/SortNode";
import type {QueryResultNode} from "../../types";
import {sortNodes} from "../sorting";

export class SortTransform implements QueryTransform {
	constructor(private readonly sort: SortNode) {}

	apply(nodes: QueryResultNode[], env: QueryEnv): QueryResultNode[] {
		return sortNodes(nodes, this.sort.keys, env);
	}
}
