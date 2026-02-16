/**
 * RelationSpecNode - Relation specification in FROM clause
 */

import type { SyntaxNode } from "@lezer/common";
import { Node } from "../base/Node";
import type {
	Span,
	NodeDoc,
	ValidationContext,
	CompletionContext,
} from "../types";
import { register, type ConvertContext } from "../registry";
import { normalizeLabel, normalizeRelationName } from "../../../relations";

@register("RelationSpecNode", { clause: true })
export class RelationSpecNode extends Node {
	readonly name: string;
	readonly label?: string;
	readonly depth: number | "unlimited";
	/** true = flatten all, number = flatten from depth N */
	readonly flatten?: number | true;

	static providesContexts: CompletionContext[] = ["after-relation"];

	static documentation: NodeDoc = {
		title: "Relation Specification",
		description:
			"Specifies a relation to traverse with optional depth and flatten modifiers. Use 'flatten' to flatten all, or 'flatten N' to flatten from depth N. If depth is omitted, traversal is unlimited. Use dot notation (e.g., up.author) to filter by label.",
		syntax: "relation[.label] [:depth N] [:flatten [N]]",
		examples: [
			"up :depth 3",
			"down",
			"up.author",
			"same :flatten",
			"down :depth 5 :flatten 2",
		],
	};

	constructor(
		name: string,
		depth: number | "unlimited",
		span: Span,
		flatten?: number | true,
		label?: string,
	) {
		super(span);
		this.name = name;
		this.label = label;
		this.depth = depth;
		this.flatten = flatten;
	}

	validate(ctx: ValidationContext): void {
		if (!ctx.hasRelation(this.name)) {
			ctx.addError(
				`Unknown relation: ${this.name}`,
				this.span,
				"UNKNOWN_RELATION",
			);
		}
	}

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): RelationSpecNode {
		const relationNameNode = node.getChild("RelationName");
		if (!relationNameNode) throw new Error("Missing relation name");

		const identNodes = relationNameNode.getChildren("Identifier");
		const nameIdent = identNodes[0];
		if (!nameIdent) throw new Error("Missing relation identifier");

		const name = normalizeRelationName(ctx.text(nameIdent));
		const label = identNodes[1]
			? normalizeLabel(ctx.text(identNodes[1]))
			: undefined;

		let depth: number | "unlimited" = "unlimited";
		let flatten: number | true | undefined;

		const options = node.getChildren("RelationOption");
		for (const opt of options) {
			const optText = ctx.text(opt).trim();
			if (optText.startsWith(":depth")) {
				const numNode = opt.getChild("Number");
				if (numNode) {
					depth = parseInt(ctx.text(numNode), 10);
				}
			} else if (optText.startsWith(":flatten")) {
				const numNode = opt.getChild("Number");
				if (numNode) {
					flatten = parseInt(ctx.text(numNode), 10);
				} else {
					flatten = true;
				}
			}
		}

		return new RelationSpecNode(
			name,
			depth,
			ctx.span(node),
			flatten,
			label,
		);
	}
}
