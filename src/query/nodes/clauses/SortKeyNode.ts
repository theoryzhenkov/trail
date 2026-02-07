/**
 * SortKeyNode - Sort key in SORT BY clause
 */

import type {SyntaxNode} from "@lezer/common";
import {ClauseNode} from "../base/ClauseNode";
import {PropertyNode} from "../expressions/PropertyNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext} from "../types";
import {register, type ConvertContext} from "../registry";

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

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): SortKeyNode {
		const keyExprNode = node.getChild("SortKeyExpr");
		if (!keyExprNode) throw new Error("Missing sort key expression");

		const builtinProp = keyExprNode.getChild("BuiltinPropertyAccess");
		const propAccess = keyExprNode.getChild("PropertyAccess");

		let key: PropertyNode;
		if (builtinProp) {
			key = PropertyNode.fromBuiltinSyntax(builtinProp, ctx);
		} else if (propAccess) {
			key = PropertyNode.fromSyntax(propAccess, ctx);
		} else {
			throw new Error(`Invalid sort key expression: ${ctx.text(keyExprNode).trim()}`);
		}

		let direction: "asc" | "desc" = "asc";
		const directionNode = node.getChild("SortDirection");
		if (directionNode) {
			const dirText = ctx.text(directionNode).trim();
			if (dirText === ":desc") direction = "desc";
		}

		return new SortKeyNode(key, direction, ctx.span(node));
	}
}
