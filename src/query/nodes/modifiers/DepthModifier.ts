/**
 * :depth modifier - traversal depth limit
 */

import {ModifierNode} from "../base/ModifierNode";
import {register} from "../registry";
import type {NodeDoc, Completable} from "../types";

@register("DepthModifier", {modifier: true})
export class DepthModifier extends ModifierNode {
	static keyword = ":depth";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: ":depth",
		description: "Sets how many levels to traverse for a relation. If omitted, depth is unlimited.",
		syntax: ":depth N",
		examples: ["from up :depth 3", "from down :depth 1"],
	};
	static completable: Completable = {
		keywords: [":depth"],
		context: "after-relation",
		priority: 80,
		category: "keyword",
	};
}
