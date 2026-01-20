/**
 * :chain modifier - sort by chain/traversal order
 */

import {ModifierNode} from "../base/ModifierNode";
import {register} from "../registry";
import type {NodeDoc, Completable} from "../types";

@register("ChainModifier", {modifier: true})
export class ChainModifier extends ModifierNode {
	static keyword = ":chain";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: ":chain",
		description:
			"Sort by graph traversal order. Keeps nodes in the order they were discovered during relation traversal. Useful for sequential relations like 'next'.",
		syntax: "sort :chain [:asc|:desc]",
		examples: ["sort :chain", "sort :chain :desc", "sort date :asc, :chain"],
	};
	static completable: Completable = {
		keywords: [":chain"],
		context: "sort-key",
		priority: 60,
		category: "keyword",
	};
}
