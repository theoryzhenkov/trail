/**
 * Traversal Source
 *
 * Produces result nodes by traversing the graph from a starting path
 * using the FROM clause configuration. Wraps the existing traverseFrom
 * logic from query-executor.ts behind the QuerySource interface.
 */

import type { QuerySource } from "../pipeline";
import type { QueryEnv } from "../../context";
import type { FromNode } from "../../clauses/FromNode";
import type { PruneNode } from "../../clauses/PruneNode";
import type { QueryResultNode } from "../../types";
import {
	traverse,
	buildFilter,
	createChainHandler,
	createGroupResolver,
	type TraversalConfig,
} from "../traversal";

export class TraversalSource implements QuerySource {
	constructor(
		private readonly from: FromNode,
		private readonly prune?: PruneNode,
	) {}

	produce(env: QueryEnv, startPath: string): QueryResultNode[] {
		const results: QueryResultNode[] = [];

		const filter = buildFilter(env, {
			pruneExpr: this.prune?.expression,
		});

		const resolveGroup = createGroupResolver(env, filter);

		for (const relationChain of this.from.chains) {
			const hasChain = relationChain.chain.length > 0;

			const config: TraversalConfig = {
				startPath,
				relation: relationChain.first.name,
				label: relationChain.first.label,
				maxDepth:
					relationChain.first.depth === "unlimited"
						? Infinity
						: relationChain.first.depth,
				filter,
				output: {
					flattenFrom: relationChain.first.flatten,
				},
				onLeaf: hasChain
					? createChainHandler(env, {
							chain: relationChain.chain,
							filter,
							resolveGroup,
						})
					: undefined,
			};

			const result = traverse(env, config);
			results.push(...result.nodes);

			for (const warning of result.warnings) {
				env.addWarning(warning.message);
			}
		}

		return results;
	}
}
