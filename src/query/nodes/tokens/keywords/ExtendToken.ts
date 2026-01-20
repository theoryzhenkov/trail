/**
 * EXTEND modifier token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("ExtendToken", {keyword: "extend"})
export class ExtendToken extends TokenNode {
	static keyword = "extend";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "extend modifier",
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
