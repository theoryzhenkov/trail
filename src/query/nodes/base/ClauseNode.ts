/**
 * Clause Node Base Class
 * 
 * Abstract base for query clause nodes (FROM, WHERE, SORT, etc.)
 */

import {Node} from "./Node";
import type {Span} from "../types";

/**
 * Abstract base class for clause nodes
 */
export abstract class ClauseNode extends Node {
	constructor(span: Span) {
		super(span);
	}
}
