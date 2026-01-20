/**
 * WHERE keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class WhereToken extends TokenNode {
	static keyword = "where";
	static highlighting = "keyword" as const;
	static documentation: NodeDoc = {
		title: "WHERE clause",
		description: "Filters results after traversal. Non-matching nodes are hidden but their children may still appear with a gap indicator.",
		syntax: "where Expression",
		examples: [
			"where priority >= 3",
			'where status !=? "archived"',
			'where hasTag("active") and exists(due)',
		],
	};
}
