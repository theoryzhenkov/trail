/**
 * StringNode - String literal
 */

import type {SyntaxNode} from "@lezer/common";
import {LiteralNode} from "../base/LiteralNode";
import type {Span, NodeDoc} from "../types";
import {register, type ConvertContext} from "../registry";

@register("StringNode", {term: "String"})
export class StringNode extends LiteralNode<string> {
	static documentation: NodeDoc = {
		title: "String Literal",
		description: "A string value enclosed in double quotes. Supports escape sequences: \\\\ \\\" \\n \\t",
		syntax: '"text"',
		examples: ['"active"', '"Project Name"', '"line1\\nline2"'],
	};

	static highlighting = "string" as const;

	constructor(value: string, span: Span) {
		super(value, span);
	}

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): StringNode {
		const value = ctx.parseString(ctx.text(node));
		return new StringNode(value, ctx.span(node));
	}
}
