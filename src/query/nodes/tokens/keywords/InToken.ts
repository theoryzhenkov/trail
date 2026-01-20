/**
 * IN keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("InToken", {keyword: "in"})
export class InToken extends TokenNode {
	static keyword = "in";
	static highlighting = "operatorKeyword" as const;
	static documentation: NodeDoc = {
		title: "IN operator",
		description: "Checks membership in array, substring in string, or value in range.",
		syntax: "Value in Collection | Value in Lower..Upper",
		examples: ['"tag" in tags', '"sub" in title', "priority in 1..5", "date in 2024-01-01..today"],
	};
}
