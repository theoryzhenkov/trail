/**
 * SortKeyNode - Sort key in SORT BY clause
 */

import {ClauseNode} from "../base/ClauseNode";
import {PropertyNode} from "../expressions/PropertyNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext} from "../types";
import {register} from "../registry";

@register("SortKeyNode", {clause: true})
export class SortKeyNode extends ClauseNode {
	readonly key: "chain" | PropertyNode;
	readonly direction: "asc" | "desc";

	static providesContexts: CompletionContext[] = ["sort-key-modifier"];

	static documentation: NodeDoc = {
		title: "Sort Key",
		description: "Specifies a property or $chain to sort by, with optional direction. Use $chain to maintain graph traversal order.",
		syntax: "property [asc|desc] | $chain [asc|desc]",
		examples: ["date desc", "$chain", "priority asc", "$file.modified desc"],
	};

	constructor(key: "chain" | PropertyNode, direction: "asc" | "desc", span: Span) {
		super(span);
		this.key = key;
		this.direction = direction;
	}

	validate(ctx: ValidationContext): void {
		if (this.key !== "chain") {
			this.key.validate(ctx);
		}
	}
}
