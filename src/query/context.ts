/**
 * TQL Query Context - Interface for query execution
 */

import type {Value} from "./ast";
import type {ValidatedQuery} from "./validator";
import type {QueryResult} from "./result";
import type {RelationEdge, FileProperties, VisualDirection} from "../types";
import type {FileMetadata} from "./builtins";

/**
 * Context interface for query execution
 * Wraps GraphStore and settings to provide query-time access
 */
export interface QueryContext {
	// Graph access
	getOutgoingEdges(path: string, relation?: string): RelationEdge[];
	getIncomingEdges(path: string, relation?: string): RelationEdge[];
	getProperties(path: string): FileProperties;
	getFileMetadata(path: string): FileMetadata | undefined;

	// Settings access
	getRelationNames(): string[];
	getVisualDirection(relation: string): VisualDirection;
	getSequentialRelations(): Set<string>;
	resolveGroupQuery(name: string): ValidatedQuery | undefined;

	// Active file
	activeFilePath: string;
	activeFileProperties: FileProperties;

	// Caching (optional)
	getCachedResult?(query: ValidatedQuery): QueryResult | undefined;
	setCachedResult?(query: ValidatedQuery, result: QueryResult): void;
}

/**
 * Convert FileProperties to Value type for expression evaluation
 */
export function propertiesToValues(props: FileProperties): Record<string, Value> {
	const result: Record<string, Value> = {};
	for (const [key, value] of Object.entries(props)) {
		if (value === undefined) {
			result[key] = null;
		} else if (Array.isArray(value)) {
			result[key] = value as Value[];
		} else {
			result[key] = value as Value;
		}
	}
	return result;
}
