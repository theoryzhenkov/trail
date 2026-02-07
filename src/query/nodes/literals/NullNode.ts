/**
 * NullNode - Null literal
 */

import type {SyntaxNode} from "@lezer/common";
import {LiteralNode} from "../base/LiteralNode";
import type {Span, NodeDoc} from "../types";
import {register, type ConvertContext} from "../registry";

@register("NullNode", {term: "Null"})
export class NullNode extends LiteralNode<null> {
	static documentation: NodeDoc = {
		title: "Null Literal",
		description: "Represents absence of a value. Use with = and != to check for null, or =? and !=? for null-safe comparisons.",
		syntax: "null",
		examples: ["status = null", "status != null", "status =? null"],
	};

	static highlighting = "atom" as const;

	constructor(span: Span) {
		super(null, span);
	}

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): NullNode {
		return new NullNode(ctx.span(node));
	}
}
