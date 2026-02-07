/**
 * BooleanNode - Boolean literal
 */

import type {SyntaxNode} from "@lezer/common";
import {LiteralNode} from "../base/LiteralNode";
import type {Span, NodeDoc} from "../types";
import {register, type ConvertContext} from "../registry";

@register("BooleanNode", {term: "Boolean"})
export class BooleanNode extends LiteralNode<boolean> {
	static documentation: NodeDoc = {
		title: "Boolean Literal",
		description: "A boolean value: true or false.",
		syntax: "true | false",
		examples: ["true", "false"],
	};

	static highlighting = "atom" as const;

	constructor(value: boolean, span: Span) {
		super(value, span);
	}

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): BooleanNode {
		const value = ctx.text(node).toLowerCase() === "true";
		return new BooleanNode(value, ctx.span(node));
	}
}
