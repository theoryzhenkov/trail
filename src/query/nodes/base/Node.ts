/**
 * Base Node Class
 * 
 * Abstract base for all TQL AST nodes. Provides:
 * - Source span for error reporting
 * - Abstract validate() method
 * - Static documentation and highlighting metadata
 */

import type {Span, NodeDoc, HighlightCategory, ValidationContext} from "../types";

/**
 * Abstract base class for all TQL nodes
 */
export abstract class Node {
	readonly span: Span;

	constructor(span: Span) {
		this.span = span;
	}

	/**
	 * Validate this node against the given context.
	 * Implementations should call validate() on child nodes.
	 */
	abstract validate(ctx: ValidationContext): void;

	/**
	 * Documentation for this node type (for hover/autocomplete)
	 */
	static documentation: NodeDoc | undefined;

	/**
	 * Highlighting category for syntax highlighting
	 */
	static highlighting: HighlightCategory | undefined;
}
