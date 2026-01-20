/**
 * SORT keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("SortToken", {keyword: "sort"})
export class SortToken extends TokenNode {
	static keyword = "sort";
	static highlighting = "keyword" as const;
}
