/**
 * StringNode - String literal
 */

import {LiteralNode} from "../base/LiteralNode";
import {register} from "../registry";
import type {Span, NodeDoc} from "../types";

@register("string", {expr: true})
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
}
