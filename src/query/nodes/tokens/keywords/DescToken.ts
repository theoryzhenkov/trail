/**
 * DESC keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("DescToken", {keyword: "desc"})
export class DescToken extends TokenNode {
	static keyword = "desc";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "desc",
		description: "Descending sort order (Z-A, 9-0, newest first).",
		examples: ["sort date desc", "sort priority desc"],
	};
}
