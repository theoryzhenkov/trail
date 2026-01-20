/**
 * NullNode - Null literal
 */

import {LiteralNode} from "../base/LiteralNode";
import type {Span, NodeDoc} from "../types";
import {register} from "../registry";

@register("NullNode")
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
}
