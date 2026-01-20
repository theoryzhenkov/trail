/**
 * RelationSpecNode - Relation specification in FROM clause
 */

import {ClauseNode} from "../base/ClauseNode";
import type {Span, NodeDoc, ValidationContext} from "../types";

export class RelationSpecNode extends ClauseNode {
	readonly name: string;
	readonly depth: number | "unlimited";
	readonly extend?: string;
	readonly flatten?: boolean;

	static documentation: NodeDoc = {
		title: "Relation Specification",
		description: "Specifies a relation to traverse with optional depth, extend, and flatten modifiers.",
		syntax: "relation [depth N|unlimited] [extend Group] [flatten]",
		examples: ["up depth 3", "down extend Children", "same flatten"],
	};

	constructor(
		name: string,
		depth: number | "unlimited",
		span: Span,
		extend?: string,
		flatten?: boolean
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
