/**
 * TQL Node Types and Shared Interfaces
 */

import type {
	FileProperties,
	RelationEdge,
	VisualDirection,
} from "../../types";

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
	| "keyword" // Clause keywords (group, from, where, etc.)
	| "typeName" // Modifiers (depth, extend, asc, desc, etc.)
	| "operatorKeyword" // Logical operators (and, or, not, in)
	| "operator" // Symbolic operators (=, !=, <, >, etc.)
	| "string" // String literals
	| "number" // Number and duration literals
	| "atom" // Boolean, null, date keywords
	| "function" // Function names
	| "property" // Property prefixes (file., traversal.)
	| "variable" // Identifiers, property names
	| "punctuation"; // Delimiters (, . ( ))

/**
 * Traversal context for WHERE/PRUNE evaluation
 */
export interface TraversalContext {
	depth: number;
	relation: string;
	label?: string;
	isImplied: boolean;
	parent: string | null;
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
		public span: Span,
	) {
		super(message);
		this.name = "RuntimeError";
	}
}

/**
 * A display property with evaluated value
 */
export interface DisplayProperty {
	key: string;
	value: Value;
}

/**
 * Core traversal node - graph structure only
 */
export interface TraversalNode {
	path: string;
	relation: string;
	label?: string;
	depth: number;
	implied: boolean;
	impliedFrom?: string;
	parent: string | null;
	traversalPath: string[];
	properties: FileProperties;
	hasFilteredAncestor: boolean;
	children: TraversalNode[];
}

/**
 * Query result node with display metadata
 * Used during sorting and UI transformation phases
 */
export interface QueryResultNode extends TraversalNode {
	displayProperties: DisplayProperty[];
	visualDirection: VisualDirection;
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
	getOutgoingEdges(
		path: string,
		relation?: string,
		label?: string,
	): RelationEdge[];
	getIncomingEdges(
		path: string,
		relation?: string,
		label?: string,
	): RelationEdge[];
	getProperties(path: string): FileProperties;
	getFileMetadata(path: string): FileMetadata | undefined;
	getRelationNames(): string[];
	resolveRelationUid(name: string): string | undefined;
	getRelationName(uid: string): string;
	getVisualDirection(relationUid: string): VisualDirection;
	resolveGroupQuery(name: string): unknown;
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

// ============================================================================
// Autocompletion Types
// ============================================================================

/**
 * Context positions where completions can appear
 */
export type CompletionContext =
	| "query-start" // Start of query (expects "group")
	| "after-group" // After group keyword (expects string)
	| "after-group-name" // After group name (expects "from")
	| "clause" // Position where clause keywords are valid
	| "relation" // After "from" or in relation position
	| "after-relation" // After relation name (depth, extend, flatten modifiers)
	| "expression" // Expression position (where, when, prune, etc.)
	| "after-expression" // After an expression (and, or, operators)
	| "sort-key" // After "sort"
	| "sort-key-modifier" // After sort key (asc, desc)
	| "display" // After "display"
	| "function-arg" // Inside function arguments
	| "property"; // Property path position

/**
 * Completion metadata for nodes that can be suggested
 */
export interface Completable {
	/**
	 * Keywords that trigger this completion
	 */
	keywords?: string[];

	/**
	 * Context(s) where this completion is valid
	 */
	context: CompletionContext | CompletionContext[];

	/**
	 * Priority for sorting (higher = shown first)
	 */
	priority?: number;

	/**
	 * Category for grouping in completion menu
	 */
	category?: "keyword" | "operator" | "function" | "property" | "value";

	/**
	 * Snippet to insert (with $1, $2 placeholders)
	 */
	snippet?: string;
}

/**
 * Static interface for nodes that provide completion contexts
 */
export interface ContextProvider {
	/** Contexts this node provides to completions at cursor positions inside it */
	providesContexts?: CompletionContext[];
}

/**
 * A completion suggestion
 */
export interface Suggestion {
	/** Text to display */
	label: string;
	/** Text to insert */
	insertText: string;
	/** Kind of completion */
	kind:
		| "keyword"
		| "operator"
		| "function"
		| "property"
		| "value"
		| "snippet";
	/** Documentation */
	detail?: string;
	/** Full documentation */
	documentation?: string;
	/** Sort priority */
	priority: number;
}
