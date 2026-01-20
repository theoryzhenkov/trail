/**
 * :extend modifier - extend traversal at leaf nodes
 */

import {ModifierNode} from "../base/ModifierNode";
import {register} from "../registry";
import type {NodeDoc, Completable} from "../types";

@register("ExtendModifier", {modifier: true})
export class ExtendModifier extends ModifierNode {
	static keyword = "extend";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "extend",
		description: "At leaf nodes, continue traversal using another group's FROM definition.",
		syntax: 'extend GroupName | extend "Group Name"',
		examples: ["from up extend Children", 'from up extend "My Group" depth 5'],
	};
	static completable: Completable = {
		keywords: ["extend"],
		context: "after-relation",
		priority: 70,
		category: "keyword",
	};
}
