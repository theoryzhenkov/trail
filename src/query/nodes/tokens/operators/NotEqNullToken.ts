/**
 * Null-safe Not Equals (!=?) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("NotEqNull", {keyword: "!=?"})
export class NotEqNullToken extends TokenNode {
	static keyword = "!=?";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: "!=? (null-safe not equals)",
		description: "Null-safe inequality. Returns true if left side is null, otherwise compares normally.",
		syntax: "expr !=? expr",
		examples: ['status !=? "archived"  // true if status is null'],
	};
}
