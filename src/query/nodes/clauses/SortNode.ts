/**
 * SortNode - SORT BY clause
 */

import {ClauseNode} from "../base/ClauseNode";
import {SortKeyNode} from "./SortKeyNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext} from "../types";
import {register} from "../registry";

@register("SortNode", {clause: true})
export class SortNode extends ClauseNode {
	readonly keys: SortKeyNode[];

	static providesContexts: CompletionContext[] = ["sort-key", "clause"];

	static documentation: NodeDoc = {
		title: "SORT clause",
		description: "Orders results by one or more properties or :chain position.",
		syntax: "sort key [:asc|:desc], ...",
		examples: ["sort date :desc", "sort :chain", "sort $file.modified :desc"],
	};

	constructor(keys: SortKeyNode[], span: Span) {
		super(span);
		this.keys = keys;
	}

	validate(ctx: ValidationContext): void {
		for (const key of this.keys) {
			key.validate(ctx);
		}
	}
}
