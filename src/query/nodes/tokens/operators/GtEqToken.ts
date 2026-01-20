/**
 * Greater Than or Equal (>=) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("GtEq", {keyword: ">="})
export class GtEqToken extends TokenNode {
	static keyword = ">=";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: ">= (greater than or equal)",
		description: "Greater than or equal comparison.",
		syntax: "expr >= expr",
		examples: ["priority >= 3", "date >= startOfWeek"],
	};
}
