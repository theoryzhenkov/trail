/**
 * PRUNE keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

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
}
