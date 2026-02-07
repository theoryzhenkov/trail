/**
 * DisplayNode - DISPLAY clause
 *
 * @see docs/syntax/query.md#display
 */

import type {SyntaxNode} from "@lezer/common";
import {ClauseNode} from "../base/ClauseNode";
import {PropertyNode} from "../expressions/PropertyNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import {register, type ConvertContext} from "../registry";

@register("DisplayNode", {clause: true})
export class DisplayNode extends ClauseNode {
	readonly all: boolean;
	readonly properties: PropertyNode[];

	static providesContexts: CompletionContext[] = ["display", "clause"];

	static documentation: NodeDoc = {
		title: "DISPLAY clause",
		description: "Specifies which properties to show in the Trail pane UI.",
		syntax: "display Property, ... | all [, Property, ...]",
		examples: ["display status, priority", "display all", "display all, file.modified"],
	};

	static completable: Completable = {
		keywords: ["display"],
		context: "clause",
		priority: 40,
		category: "keyword",
	};

	constructor(all: boolean, properties: PropertyNode[], span: Span) {
		super(span);
		this.all = all;
		this.properties = properties;
	}

	validate(ctx: ValidationContext): void {
		for (const prop of this.properties) {
			prop.validate(ctx);
		}
	}

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): DisplayNode {
		const displayList = node.getChild("DisplayList");
		if (!displayList) throw new Error("Missing display list");

		const kids = ctx.allChildren(displayList);
		let all = false;
		const properties: PropertyNode[] = [];

		for (const kid of kids) {
			if (kid.name === "all") {
				all = true;
			} else if (kid.name === "DisplayItem") {
				const builtinProp = kid.getChild("BuiltinPropertyAccess");
				const propAccess = kid.getChild("PropertyAccess");

				if (builtinProp) {
					properties.push(PropertyNode.fromBuiltinSyntax(builtinProp, ctx));
				} else if (propAccess) {
					properties.push(PropertyNode.fromSyntax(propAccess, ctx));
				}
			}
		}

		return new DisplayNode(all, properties, ctx.span(node));
	}
}
