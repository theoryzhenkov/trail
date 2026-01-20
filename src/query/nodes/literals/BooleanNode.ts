/**
 * BooleanNode - Boolean literal
 */

import {LiteralNode} from "../base/LiteralNode";
import type {Span, NodeDoc} from "../types";
import {register} from "../registry";

@register("BooleanNode")
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
}
