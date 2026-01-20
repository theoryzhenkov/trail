/**
 * NumberNode - Number literal
 */

import {LiteralNode} from "../base/LiteralNode";
import type {Span, NodeDoc} from "../types";

export class NumberNode extends LiteralNode<number> {
	static documentation: NodeDoc = {
		title: "Number Literal",
		description: "A numeric value. Supports integers and decimals.",
		syntax: "123 | 45.67",
		examples: ["5", "3.14", "100"],
	};

	static highlighting = "number" as const;

	constructor(value: number, span: Span) {
		super(value, span);
	}
}
