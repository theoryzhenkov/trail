/**
 * Binary Node Base Class
 * 
 * Abstract base for expressions with left and right operands.
 */

import {ExprNode} from "./ExprNode";
import type {Span, ValidationContext} from "../types";

/**
 * Abstract base class for binary expression nodes
 */
export abstract class BinaryNode extends ExprNode {
	readonly left: ExprNode;
	readonly right: ExprNode;

	constructor(left: ExprNode, right: ExprNode, span: Span) {
		super(span);
		this.left = left;
		this.right = right;
	}

	/**
	 * Default validation: validate both children
	 */
	validate(ctx: ValidationContext): void {
		this.left.validate(ctx);
		this.right.validate(ctx);
	}
}
