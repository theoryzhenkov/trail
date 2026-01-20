/**
 * Less Than (<) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("Lt", {keyword: "<"})
export class LtToken extends TokenNode {
	static keyword = "<";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: "< (less than)",
		description: "Less than comparison. Works with numbers, strings, and dates.",
		syntax: "expr < expr",
		examples: ["priority < 5", "date < today"],
	};
}
