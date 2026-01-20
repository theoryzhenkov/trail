/**
 * Builtin Node Base Class
 * 
 * Abstract base for built-in identifier nodes ($file, $traversal, $chain).
 * These nodes represent built-in namespaces and their properties.
 */

import {Node} from "./Node";
import type {Span, NodeDoc, ValidationContext} from "../types";

/**
 * Built-in property definition
 */
export interface BuiltinProperty {
	name: string;
	type: string;
	description: string;
}

/**
 * Abstract base class for builtin identifier nodes
 */
export abstract class BuiltinNode extends Node {
	/**
	 * Properties available on this builtin
	 */
	static properties: BuiltinProperty[];

	/**
	 * Documentation for this builtin
	 */
	static documentation: NodeDoc;

	constructor(span: Span) {
		super(span);
	}

	/**
	 * Builtins don't need validation (they're just identifiers)
	 */
	validate(_ctx: ValidationContext): void {
		// No validation needed for builtins
	}
}
