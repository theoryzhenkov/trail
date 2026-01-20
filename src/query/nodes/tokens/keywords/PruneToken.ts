/**
 * PRUNE keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("PruneToken", {keyword: "prune"})
export class PruneToken extends TokenNode {
	static keyword = "prune";
	static highlighting = "keyword" as const;
	static documentation: NodeDoc = {
		title: "PRUNE clause",
		description: "Stops traversal at nodes matching the expression. Matching nodes and their subtrees are not visited.",
		syntax: "prune Expression",
		examples: [
			'prune status = "archived"',
			'prune hasTag("private")',
			"prune traversal.depth > 5",
		],
	};
	static completable: Completable = {
		keywords: ["prune"],
		context: "clause",
		priority: 50,
		category: "keyword",
	};
}
