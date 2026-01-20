/**
 * Literal Node Base Class
 * 
 * Abstract base for literal value nodes.
 */

import {ExprNode} from "./ExprNode";
import type {Span, Value, ValidationContext} from "../types";
import type {ExecutorContext} from "../context";

/**
 * Abstract base class for literal nodes
 */
export abstract class LiteralNode<T extends Value> extends ExprNode {
	readonly value: T;

	constructor(value: T, span: Span) {
		super(span);
		this.value = value;
	}

	/**
	 * Literals evaluate to their value
	 */
	evaluate(_ctx: ExecutorContext): Value {
		return this.value;
	}

	/**
	 * Literals don't need validation
	 */
	validate(_ctx: ValidationContext): void {
		// No validation needed for literals
	}
}
