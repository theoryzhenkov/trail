/**
 * Equals (=) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("Eq", {keyword: "="})
export class EqToken extends TokenNode {
	static keyword = "=";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: "= (equals)",
		description: "Equality comparison. When comparing with null, checks if value is null.",
		syntax: "expr = expr",
		examples: ['status = "active"', "priority = 5", "value = null"],
	};
}
