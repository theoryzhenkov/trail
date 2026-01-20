/**
 * Token Node Base Class
 * 
 * Abstract base for lexer token nodes.
 */

import {Node} from "./Node";
import type {Span, NodeDoc, HighlightCategory, ValidationContext} from "../types";

/**
 * Abstract base class for token nodes
 */
export abstract class TokenNode extends Node {
	readonly value: string;

	constructor(value: string, span: Span) {
		super(span);
		this.value = value;
	}

	/**
	 * Tokens don't need validation
	 */
	validate(_ctx: ValidationContext): void {
		// No validation needed for tokens
	}

	/**
	 * The keyword string for this token (for lexer matching)
	 */
	static keyword: string | undefined;

	/**
	 * Documentation for this token type
	 */
	static documentation: NodeDoc | undefined;

	/**
	 * Highlighting category for syntax highlighting
	 */
	static highlighting: HighlightCategory | undefined;
}
