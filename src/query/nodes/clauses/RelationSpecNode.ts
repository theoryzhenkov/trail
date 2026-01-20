/**
 * RelationSpecNode - Relation specification in FROM clause
 */

import {ClauseNode} from "../base/ClauseNode";
import type {Span, NodeDoc, ValidationContext} from "../types";

export class RelationSpecNode extends ClauseNode {
	readonly name: string;
	readonly depth: number | "unlimited";
	readonly extend?: string;
	/** true = flatten all, number = flatten from depth N */
	readonly flatten?: number | true;

	static documentation: NodeDoc = {
		title: "Relation Specification",
		description: "Specifies a relation to traverse with optional depth, extend, and flatten modifiers. Use 'flatten' to flatten all, or 'flatten N' to flatten from depth N. If depth is omitted, traversal is unlimited.",
		syntax: "relation [depth N] [extend Group] [flatten [N]]",
		examples: ["up depth 3", "down", "down extend Children", "same flatten", "down depth 5 flatten 2"],
	};

	constructor(
		name: string,
		depth: number | "unlimited",
		span: Span,
		extend?: string,
		flatten?: number | true
	) {
		super(span);
		this.name = name;
		this.depth = depth;
		this.extend = extend;
		this.flatten = flatten;
	}

	validate(ctx: ValidationContext): void {
		if (!ctx.hasRelation(this.name)) {
			ctx.addError(`Unknown relation: ${this.name}`, this.span, "UNKNOWN_RELATION");
		}
		if (this.extend && !ctx.hasGroup(this.extend)) {
			ctx.addError(`Unknown group for extend: ${this.extend}`, this.span, "UNKNOWN_GROUP");
		}
	}
}
