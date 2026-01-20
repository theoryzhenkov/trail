/**
 * Expression Node Base Class
 * 
 * Abstract base for all expression nodes that can be evaluated.
 */

import {Node} from "./Node";
import type {Span, Value} from "../types";
import type {ExecutorContext} from "../context";

/**
 * Abstract base class for expression nodes
 */
export abstract class ExprNode extends Node {
	constructor(span: Span) {
		super(span);
	}

	/**
	 * Evaluate this expression in the given context.
	 * Returns null on error after calling ctx.addError().
	 */
	abstract evaluate(ctx: ExecutorContext): Value;
}
