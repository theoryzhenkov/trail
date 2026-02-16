/**
 * Execution module - helpers for query execution
 */

// Traversal (new unified implementation)
export {
	traverse,
	buildFilter,
	createChainHandler,
	createGroupResolver,
	INCLUDE_ALL,
	type TraversalConfig,
	type TraversalResult,
	type NodeFilter,
	type FilterDecision,
	type OutputConfig,
	type NodeContext,
	type LeafHandler,
} from "./traversal";

// Sorting
export {sortNodes} from "./sorting";

// Query execution
export {executeQueryClauses, type ExecuteQueryOptions} from "./query-executor";

// Pipeline
export {
	executePipeline,
	type QueryGuard,
	type QuerySource,
	type QueryTransform,
	type QueryPipeline,
} from "./pipeline";

// Pipeline implementations
export {WhereTransform, SortTransform, DisplayTransform} from "./transforms";
export {TraversalSource} from "./sources";
export {WhenGuard} from "./guards";
