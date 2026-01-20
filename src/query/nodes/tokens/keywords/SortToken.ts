/**
 * SORT keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("Sort", {keyword: "sort"})
export class SortToken extends TokenNode {
	static keyword = "sort";
	static highlighting = "keyword" as const;
	static documentation: NodeDoc = {
		title: "SORT clause",
		description: "Orders results by property or chain position. Multiple sort keys are comma-separated.",
		syntax: "sort by Key [asc|desc], ...",
		examples: [
			"sort by date desc",
			"sort by chain, priority desc",
			"sort by file.modified desc, file.name",
		],
	};
}
