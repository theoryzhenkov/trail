/**
 * ASC keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("AscToken", {keyword: "asc"})
export class AscToken extends TokenNode {
	static keyword = "asc";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "asc",
		description: "Ascending sort order (A-Z, 0-9, oldest first). This is the default.",
		examples: ["sort priority asc", "sort $file.name asc"],
	};
	static completable: Completable = {
		keywords: ["asc"],
		context: "sort-key",
		priority: 50,
		category: "keyword",
	};
}
