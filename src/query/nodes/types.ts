/**
 * TQL Node Types and Shared Interfaces
 */

import type {FileProperties, RelationEdge, VisualDirection} from "../../types";

/**
 * Source span for error reporting
 */
export interface Span {
	start: number;
	end: number;
}

/**
 * Runtime value type for expression evaluation
 */
export type Value = string | number | boolean | Date | null | Value[];

/**
 * Documentation for a node class (used by hover/autocomplete)
 */
export interface NodeDoc {
	title: string;
	description: string;
	syntax?: string;
	examples?: string[];
	returnType?: string;
}

/**
 * Highlighting categories for syntax highlighting
 */
export type HighlightCategory =
	| "keyword"        // Clause keywords (group, from, where, etc.)
	| "typeName"       // Modifiers (depth, extend, asc, desc, etc.)
	| "operatorKeyword" // Logical operators (and, or, not, in)
	| "operator"       // Symbolic operators (=, !=, <, >, etc.)
	| "string"         // String literals
	| "number"         // Number and duration literals
	| "atom"           // Boolean, null, date keywords
	| "function"       // Function names
	| "property"       // Property prefixes (file., traversal.)
	| "variable"       // Identifiers, property names
	| "punctuation";   // Delimiters (, . ( ))

/**
 * Traversal context for WHERE/PRUNE evaluation
 */
export interface TraversalContext {
	depth: number;
	relation: string;
	isImplied: boolean;
	parent: string;
	path: string[];
}

/**
 * File metadata for built-in functions
 */
export interface FileMetadata {
	name: string;
	path: string;
	folder: string;
	created: Date;
	modified: Date;
	size: number;
	tags: string[];
	links: string[];
	backlinks: string[];
}

/**
 * Runtime error with source location
 */
export class RuntimeError extends Error {
	constructor(
		message: string,
		public span: Span
	) {
		super(message);
		this.name = "RuntimeError";
	}
}

/**
 * Query result node structure
 */
export interface QueryResultNode {
	path: string;
	relation: string;
	depth: number;
	implied: boolean;
	impliedFrom?: string;
	parent: string;
	traversalPath: string[];
	properties: FileProperties;
	displayProperties: string[];
	visualDirection: VisualDirection;
	hasFilteredAncestor: boolean;
	children: QueryResultNode[];
}

/**
 * Query result with warnings
 */
export interface QueryResult {
	visible: boolean;
	results: QueryResultNode[];
	warnings: QueryWarning[];
	errors?: RuntimeError[];
}

/**
 * Query warning (non-fatal issues)
 */
export interface QueryWarning {
	message: string;
}

/**
 * Query context interface (provided by plugin)
 */
export interface QueryContext {
	getOutgoingEdges(path: string, relation?: string): RelationEdge[];
	getIncomingEdges(path: string, relation?: string): RelationEdge[];
	getProperties(path: string): FileProperties;
	getFileMetadata(path: string): FileMetadata | undefined;
	getRelationNames(): string[];
	getVisualDirection(relation: string): VisualDirection;
	getSequentialRelations(): Set<string>;
	resolveGroupQuery(name: string): unknown; // Will be QueryNode after refactor
	activeFilePath: string;
	activeFileProperties: FileProperties;
}

/**
 * Validation context for validate() methods
 */
export interface ValidationContext {
	getRelationNames(): string[];
	getGroupNames(): string[];
	hasRelation(name: string): boolean;
	hasGroup(name: string): boolean;
	addError(message: string, span: Span, code: string): void;
}
