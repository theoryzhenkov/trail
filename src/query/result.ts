/**
 * TQL Query Result Types
 */

import type {VisualDirection, FileProperties} from "../types";

/**
 * Result of executing a TQL query
 */
export interface QueryResult {
	/** False if WHEN clause failed */
	visible: boolean;
	/** Result tree nodes */
	results: QueryResultNode[];
	/** Non-fatal warnings */
	warnings: QueryWarning[];
}

/**
 * A single node in the query result tree
 */
export interface QueryResultNode {
	/** File path */
	path: string;
	/** Relation that led to this node */
	relation: string;
	/** Depth from active file */
	depth: number;
	/** Whether edge is implied */
	implied: boolean;
	/** Source relation if implied */
	impliedFrom?: string;
	/** File properties */
	properties: FileProperties;
	/** Properties to display (filtered by DISPLAY clause) */
	displayProperties: string[];
	/** Visual direction for rendering */
	visualDirection: VisualDirection;
	/** True if any ancestor was WHERE-filtered */
	hasFilteredAncestor: boolean;
	/** Child nodes */
	children: QueryResultNode[];
}

/**
 * Non-fatal warning during query execution
 */
export interface QueryWarning {
	message: string;
	span?: {start: number; end: number};
}

/**
 * Create an empty result (e.g., when WHEN clause fails)
 */
export function emptyResult(visible: boolean): QueryResult {
	return {
		visible,
		results: [],
		warnings: [],
	};
}
