/**
 * DEPTH modifier token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("DepthToken", {keyword: "depth"})
export class DepthToken extends TokenNode {
	static keyword = "depth";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "depth modifier",
		description: "Sets how many levels to traverse for a relation. If omitted, depth is unlimited.",
		syntax: "depth N",
		examples: ["from up depth 3", "from down"],
	};
	static completable: Completable = {
		keywords: ["depth"],
		context: "after-relation",
		priority: 80,
		category: "keyword",
	};
}
