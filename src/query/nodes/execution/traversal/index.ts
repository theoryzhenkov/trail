/**
 * Traversal Module
 *
 * Unified graph traversal with composable filtering and configurable output.
 *
 * Main concepts:
 * - traverse(): Single entry point for all traversal modes
 * - NodeFilter: Composable filters (PRUNE, WHERE, etc.)
 * - OutputConfig: Controls tree vs flat output
 * - LeafHandler: Chain/extend processing at graph leaves
 *
 * @example
 * ```typescript
 * import { traverse, buildFilter, createChainHandler } from './traversal';
 *
 * const filter = buildFilter(ctx, { pruneExpr });
 * const result = traverse(ctx, {
 *   startPath: "root.md",
 *   relation: "down",
 *   maxDepth: Infinity,
 *   filter,
 *   output: { flattenFrom: undefined }, // tree mode
 *   onLeaf: createChainHandler(ctx, { chain, filter }),
 * });
 * ```
 */

// Types
export type {
	NodeContext,
	NodeFilter,
	FilterDecision,
	OutputConfig,
	TraversalConfig,
	TraversalResult,
	LeafHandler,
} from "./types";

export {INCLUDE_ALL} from "./types";

// Filter building
export {
	buildFilter,
	combineFilters,
	createPruneFilter,
	createWhereFilter,
	type FilterBuildOptions,
} from "./filter";

// State management (internal, but exposed for advanced use)
export {TraversalState, BfsTraversalState} from "./state";

// Main traversal function
export {traverse} from "./traverse";

// Chain handling
export {
	createChainHandler,
	createGroupResolver,
	type ChainHandlerOptions,
	type ChainTraversalConfig,
} from "./chain-handler";
