/**
 * NumberNode - Number literal
 */

import type {SyntaxNode} from "@lezer/common";
import {LiteralNode} from "../base/LiteralNode";
import type {Span, NodeDoc} from "../types";
import {register, type ConvertContext} from "../registry";

@register("NumberNode", {term: "Number"})
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

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): NumberNode {
		const value = parseFloat(ctx.text(node));
		return new NumberNode(value, ctx.span(node));
	}
}
