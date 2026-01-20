/**
 * NULL keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("Null", {keyword: "null"})
export class NullToken extends TokenNode {
	static keyword = "null";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "null",
		description: "Null value. Use =? and !=? for null-safe comparisons.",
		examples: ["where status != null", "where priority =? null"],
	};
}
