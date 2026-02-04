/**
 * SortKeyNode - Sort key in SORT BY clause
 */

import {ClauseNode} from "../base/ClauseNode";
import {PropertyNode} from "../expressions/PropertyNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext} from "../types";
import {register} from "../registry";

@register("SortKeyNode", {clause: true})
export class SortKeyNode extends ClauseNode {
	readonly key: PropertyNode;
	readonly direction: "asc" | "desc";

	static providesContexts: CompletionContext[] = ["sort-key-modifier"];

	static documentation: NodeDoc = {
		title: "Sort Key",
		description: "Specifies a property to sort by, with optional direction.",
		syntax: "property [:asc|:desc]",
		examples: ["date :desc", "priority :asc", "$file.modified :desc"],
	};

	constructor(key: PropertyNode, direction: "asc" | "desc", span: Span) {
		super(span);
		this.key = key;
		this.direction = direction;
	}

	validate(ctx: ValidationContext): void {
		this.key.validate(ctx);
	}
}
