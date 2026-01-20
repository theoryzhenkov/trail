/**
 * SortNode - SORT BY clause
 */

import {ClauseNode} from "../base/ClauseNode";
import {SortKeyNode} from "./SortKeyNode";
import {register} from "../registry";
import type {Span, NodeDoc, ValidationContext} from "../types";

@register("sort")
export class SortNode extends ClauseNode {
	readonly keys: SortKeyNode[];

	static documentation: NodeDoc = {
		title: "SORT clause",
		description: "Orders results by one or more properties or chain position.",
		syntax: "sort by key [asc|desc], ...",
		examples: ["sort by date desc", "sort by chain, priority desc"],
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
