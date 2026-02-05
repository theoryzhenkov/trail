/**
 * Chain Handler for Leaf Nodes
 *
 * Handles chain traversal at leaf nodes. When traversal reaches a leaf
 * (no more edges or at depth limit), the chain handler continues
 * traversal with the next relation in the chain.
 *
 * Chains are specified in FROM clause: `from up >> down >> same`
 */

import type {QueryEnv} from "../../context";
import type {QueryResultNode} from "../../types";
import type {ChainTarget} from "../../clauses/FromNode";
import type {LeafHandler, NodeContext, NodeFilter, TraversalConfig} from "./types";
import {traverse} from "./traverse";

/**
 * Options for creating a chain handler
 */
export interface ChainHandlerOptions {
	/** Chain targets to process */
	chain: ChainTarget[];
	/** Filter to apply to chained traversals */
	filter: NodeFilter;
	/** Resolver for group references */
	resolveGroup?: (name: string) => ChainTraversalConfig[] | undefined;
}

/**
 * Configuration for a chain traversal (simplified from full TraversalConfig)
 */
export interface ChainTraversalConfig {
	relation: string;
	maxDepth: number;
	flatten?: number | true;
}

/**
 * Create a leaf handler for chain processing
 */
export function createChainHandler(
	env: QueryEnv,
	options: ChainHandlerOptions
): LeafHandler {
	return {
		handle(nodeCtx: NodeContext): QueryResultNode[] {
			return extendFromChain(
				env,
				nodeCtx.path,
				options.chain,
				new Set(nodeCtx.traversalPath),
				nodeCtx.traversalPath,
				options.filter,
				options.resolveGroup
			);
		},
	};
}

/**
 * Extend traversal from chain targets
 */
function extendFromChain(
	env: QueryEnv,
	sourcePath: string,
	chain: ChainTarget[],
	ancestorPaths: Set<string>,
	traversalPath: string[],
	filter: NodeFilter,
	resolveGroup?: (name: string) => ChainTraversalConfig[] | undefined
): QueryResultNode[] {
	const results: QueryResultNode[] = [];

	for (const target of chain) {
		if (target.type === "relation") {
			// Continue with a relation
			const config: TraversalConfig = {
				startPath: sourcePath,
				relation: target.spec.name,
				maxDepth: target.spec.depth === "unlimited" ? Infinity : target.spec.depth,
				filter,
				output: {flattenFrom: target.spec.flatten},
				onLeaf: chain.length > 1
					? createChainHandler(env, {
							chain: chain.slice(1),
							filter,
							resolveGroup,
					  })
					: undefined,
			};

			const result = traverse(env, config);
			results.push(...result.nodes);
		} else if (target.type === "group") {
			// Continue with a group
			if (!resolveGroup) {
				continue;
			}

			const groupRelations = resolveGroup(target.name);
			if (!groupRelations) {
				continue;
			}

			for (const relConfig of groupRelations) {
				const config: TraversalConfig = {
					startPath: sourcePath,
					relation: relConfig.relation,
					maxDepth: relConfig.maxDepth,
					filter,
					output: {flattenFrom: relConfig.flatten},
					onLeaf: chain.length > 1
						? createChainHandler(env, {
								chain: chain.slice(1),
								filter,
								resolveGroup,
						  })
						: undefined,
				};

				const result = traverse(env, config);
				results.push(...result.nodes);
			}
		} else if (target.type === "inline") {
			// Continue with an inline query
			const inlineResults = target.query.executeQuery(env, sourcePath);
			results.push(...inlineResults);
		}
	}

	return results;
}

/**
 * Create a group resolver function
 *
 * This creates a resolver that can look up group queries and convert them
 * to chain traversal configurations.
 */
export function createGroupResolver(
	env: QueryEnv,
	filter: NodeFilter
): (name: string) => ChainTraversalConfig[] | undefined {
	return (name: string): ChainTraversalConfig[] | undefined => {
		const groupQuery = env.resolveGroupQuery(name) as
			| {from: {chains: Array<{first: {name: string; depth: number | "unlimited"; flatten?: number | true}; chain: ChainTarget[]}>}}
			| undefined;
		
		if (!groupQuery) {
			return undefined;
		}

		const configs: ChainTraversalConfig[] = [];
		for (const chain of groupQuery.from.chains) {
			configs.push({
				relation: chain.first.name,
				maxDepth: chain.first.depth === "unlimited" ? Infinity : chain.first.depth,
				flatten: chain.first.flatten,
			});
		}

		return configs.length > 0 ? configs : undefined;
	};
}
