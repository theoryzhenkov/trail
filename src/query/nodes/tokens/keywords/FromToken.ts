/**
 * FROM keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc, Completable} from "../../types";

export class FromToken extends TokenNode {
	static keyword = "from";
	static highlighting = "keyword" as const;
	static documentation: NodeDoc = {
		title: "FROM clause",
		description: "Specifies which relations to traverse. Supports multiple relations with depth and extend modifiers.",
		syntax: "from Relation [depth N] [extend Group], ...",
		examples: [
			"from up",
			"from up, down depth 2",
			"from up extend Children depth 5",
		],
	};
	static completable: Completable = {
		keywords: ["from"],
		context: "after-group-name",
		priority: 100,
		category: "keyword",
		snippet: "from $1 depth $2",
	};
}
