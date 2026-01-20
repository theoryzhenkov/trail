/**
 * SORT keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc, Completable} from "../../types";

export class SortToken extends TokenNode {
	static keyword = "sort";
	static highlighting = "keyword" as const;
	static documentation: NodeDoc = {
		title: "SORT clause",
		description: "Orders results by property or $chain position. Multiple sort keys are comma-separated.",
		syntax: "sort Key [asc|desc], ...",
		examples: [
			"sort date desc",
			"sort $chain, priority desc",
			"sort $file.modified desc, $file.name",
		],
	};
	static completable: Completable = {
		keywords: ["sort"],
		context: "clause",
		priority: 60,
		category: "keyword",
		snippet: "sort $1",
	};
}
