/**
 * Unary Node Base Class
 * 
 * Abstract base for expressions with a single operand.
 */

import {ExprNode} from "./ExprNode";
import type {Span, ValidationContext} from "../types";

/**
 * Abstract base class for unary expression nodes
 */
export abstract class UnaryNode extends ExprNode {
	readonly operand: ExprNode;

	constructor(operand: ExprNode, span: Span) {
		super(span);
		this.operand = operand;
	}

	/**
	 * Default validation: validate the operand
	 */
	validate(ctx: ValidationContext): void {
		this.operand.validate(ctx);
	}
}
