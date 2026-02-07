/**
 * SortNode - SORT BY clause
 *
 * @see docs/syntax/query.md#sort
 */

import type {SyntaxNode} from "@lezer/common";
import {ClauseNode} from "../base/ClauseNode";
import {SortKeyNode} from "./SortKeyNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import {register, type ConvertContext} from "../registry";

@register("SortNode", {clause: true})
export class SortNode extends ClauseNode {
	readonly keys: SortKeyNode[];

	static providesContexts: CompletionContext[] = ["sort-key", "clause"];

	static documentation: NodeDoc = {
		title: "SORT clause",
		description: "Orders results by property or :chain position. Multiple sort keys are comma-separated.",
		syntax: "sort Key [:asc|:desc], ...",
		examples: ["sort date :desc", "sort :chain, priority :desc", "sort $file.modified :desc, $file.name"],
	};

	static completable: Completable = {
		keywords: ["sort"],
		context: "clause",
		priority: 60,
		category: "keyword",
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

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): SortNode {
		const keyNodes = node.getChildren("SortKey");
		const keys = keyNodes.map((k) => SortKeyNode.fromSyntax(k, ctx));
		return new SortNode(keys, ctx.span(node));
	}
}
