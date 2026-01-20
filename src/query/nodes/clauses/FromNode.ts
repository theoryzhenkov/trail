/**
 * FromNode - FROM clause
 */

import {ClauseNode} from "../base/ClauseNode";
import {RelationSpecNode} from "./RelationSpecNode";
import {InlineQueryNode} from "../expressions/InlineQueryNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext} from "../types";
import {register} from "../registry";

/**
 * A chain target can be a relation spec, group reference, or inline query
 */
export type ChainTarget = 
	| {type: "relation"; spec: RelationSpecNode}
	| {type: "group"; name: string; span: Span}
	| {type: "inline"; query: InlineQueryNode};

/**
 * A relation chain: relation >> target >> target ...
 */
export type RelationChain = {
	first: RelationSpecNode;
	chain: ChainTarget[];
};

@register("FromNode", {clause: true})
export class FromNode extends ClauseNode {
	readonly chains: RelationChain[];

	static providesContexts: CompletionContext[] = ["relation", "clause"];

	static documentation: NodeDoc = {
		title: "FROM clause",
		description: "Specifies which relations to traverse from the active file. Supports chaining with >> operator.",
		syntax: "from relation [modifiers] [>> target], ...",
		examples: ["from up", "from up >> next", 'from up >> @"Children"', "from up :depth 2 >> next"],
	};

	constructor(chains: RelationChain[], span: Span) {
		super(span);
		this.chains = chains;
	}

	/**
	 * Get all relations (for backwards compatibility during migration)
	 * Returns the first relation from each chain
	 */
	get relations(): RelationSpecNode[] {
		return this.chains.map((chain) => chain.first);
	}

	validate(ctx: ValidationContext): void {
		for (const chain of this.chains) {
			chain.first.validate(ctx);
			for (const target of chain.chain) {
				if (target.type === "relation") {
					target.spec.validate(ctx);
				} else if (target.type === "group") {
					if (!ctx.hasGroup(target.name)) {
						ctx.addError(`Unknown group: ${target.name}`, target.span, "UNKNOWN_GROUP");
					}
				}
			}
		}
	}
}
