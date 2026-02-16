/**
 * GroupNode - GROUP clause
 *
 * Represents the `group "Name"` syntax at the start of a query.
 * Holds the group name as a proper clause node rather than
 * having it be a raw string on QueryNode.
 */

import type {SyntaxNode} from "@lezer/common";
import {ClauseNode} from "../base/ClauseNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import {register, type ConvertContext} from "../registry";

@register("GroupNode", {clause: true})
export class GroupNode extends ClauseNode {
	readonly name: string;

	static providesContexts: CompletionContext[] = ["after-group"];

	static documentation: NodeDoc = {
		title: "GROUP clause",
		description: "Names the query group. Each group appears as a section in the Trail pane.",
		syntax: 'group "Name"',
		examples: ['group "Children"', 'group "Related Tasks"'],
	};

	static completable: Completable = {
		keywords: ["group"],
		context: "query-start",
		priority: 100,
		category: "keyword",
	};

	constructor(name: string, span: Span) {
		super(span);
		this.name = name;
	}

	validate(_ctx: ValidationContext): void {
		// Group name is always valid if it parsed
	}

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): GroupNode {
		const stringNode = node.getChild("String");
		if (!stringNode) throw new Error("Missing group name string");
		const name = ctx.parseString(ctx.text(stringNode));
		return new GroupNode(name, ctx.span(node));
	}
}
