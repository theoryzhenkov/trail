/**
 * :asc modifier - ascending sort direction
 */

import {ModifierNode} from "../base/ModifierNode";
import {register} from "../registry";
import type {NodeDoc, Completable} from "../types";

@register("AscModifier", {modifier: true})
export class AscModifier extends ModifierNode {
	static keyword = ":asc";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: ":asc",
		description: "Ascending sort order (A-Z, 0-9, oldest first). This is the default.",
		examples: ["sort priority :asc", "sort $file.name :asc"],
	};
	static completable: Completable = {
		keywords: [":asc"],
		context: "sort-key",
		priority: 50,
		category: "keyword",
	};
}
