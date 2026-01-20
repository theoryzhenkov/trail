/**
 * ALL keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("AllToken", {keyword: "all"})
export class AllToken extends TokenNode {
	static keyword = "all";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "all",
		description: "Display all frontmatter properties. Can be combined with specific file.* properties.",
		examples: ["display all", "display all, file.created"],
	};
	static completable: Completable = {
		keywords: ["all"],
		context: "display",
		priority: 90,
		category: "keyword",
	};
}
