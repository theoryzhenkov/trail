/**
 * FromNode - FROM clause
 *
 * @see docs/syntax/query.md#from
 */

import type {SyntaxNode} from "@lezer/common";
import {ClauseNode} from "../base/ClauseNode";
import {RelationSpecNode} from "./RelationSpecNode";
import {InlineQueryNode} from "../expressions/InlineQueryNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import {register, type ConvertContext} from "../registry";

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
		description:
			"Specifies which relations to traverse. Supports multiple relations with depth, flatten, and chaining modifiers.",
		syntax: "from Relation [:depth N] [:flatten] [>> Target], ...",
		examples: ["from up", "from up, down :depth 2", "from up >> next", 'from up :depth 2 >> @"Children"'],
	};

	static completable: Completable = {
		keywords: ["from"],
		context: "after-group-name",
		priority: 100,
		category: "keyword",
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

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): FromNode {
		const relationChains = node.getChildren("RelationChain");
		const chains: RelationChain[] = [];

		for (const chainNode of relationChains) {
			const firstSpec = chainNode.getChild("RelationSpec");
			if (!firstSpec) throw new Error("Missing relation spec in chain");

			const firstRel = RelationSpecNode.fromSyntax(firstSpec, ctx);
			const chainTargets = chainNode.getChildren("ChainTarget");
			const chain: ChainTarget[] = [];

			for (const target of chainTargets) {
				const relSpec = target.getChild("RelationSpec");
				const groupRef = target.getChild("GroupReference");
				const inlineQuery = target.getChild("InlineQuery");

				if (relSpec) {
					chain.push({type: "relation", spec: RelationSpecNode.fromSyntax(relSpec, ctx)});
				} else if (groupRef) {
					const stringNode = groupRef.getChild("String");
					if (!stringNode) throw new Error("Missing string in group reference");
					const groupName = ctx.parseString(ctx.text(stringNode));
					chain.push({type: "group", name: groupName, span: ctx.span(target)});
				} else if (inlineQuery) {
					chain.push({type: "inline", query: InlineQueryNode.fromSyntax(inlineQuery, ctx)});
				}
			}

			chains.push({first: firstRel, chain});
		}

		return new FromNode(chains, ctx.span(node));
	}
}
