/**
 * all modifier - used in aggregate expressions
 */

import {ModifierNode} from "../base/ModifierNode";
import {register} from "../registry";
import type {NodeDoc, Completable} from "../types";

@register("AllModifier", {modifier: true})
export class AllModifier extends ModifierNode {
	static keyword = "all";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "all",
		description: "Modifier for aggregate functions to include all nodes.",
		examples: ["all(status = \"done\")"],
	};
	static completable: Completable = {
		keywords: ["all"],
		context: "expression",
		priority: 40,
		category: "keyword",
	};
}
