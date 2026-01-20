/**
 * GROUP keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("GroupToken", {keyword: "group"})
export class GroupToken extends TokenNode {
	static keyword = "group";
	static highlighting = "keyword" as const;
	static documentation: NodeDoc = {
		title: "GROUP clause",
		description: "Defines the name of this query group. Required as the first clause.",
		syntax: 'group "Name"',
		examples: ['group "Ancestors"', 'group "Related Projects"'],
	};
	static completable: Completable = {
		keywords: ["group"],
		context: "query-start",
		priority: 100,
		category: "keyword",
		snippet: 'group "$1"',
	};
}
