/**
 * :flatten modifier - flatten traversal results
 */

import {ModifierNode} from "../base/ModifierNode";
import {register} from "../registry";
import type {NodeDoc, Completable} from "../types";

@register("FlattenModifier", {modifier: true})
export class FlattenModifier extends ModifierNode {
	static keyword = ":flatten";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: ":flatten",
		description:
			"Output all reachable nodes as a flat list at depth 1, instead of a nested tree structure. Useful for symmetric relations like 'same' that form cliques.",
		syntax: "Relation [:depth N] :flatten [N]",
		examples: ["from same :flatten", "from down :depth 2 :flatten", "from down :depth 5 :flatten 2"],
	};
	static completable: Completable = {
		keywords: [":flatten"],
		context: "after-relation",
		priority: 60,
		category: "keyword",
	};
}
