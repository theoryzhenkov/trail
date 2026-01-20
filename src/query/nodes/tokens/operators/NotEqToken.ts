/**
 * Not Equals (!=) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("NotEq", {keyword: "!="})
export class NotEqToken extends TokenNode {
	static keyword = "!=";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: "!= (not equals)",
		description: "Inequality comparison.",
		syntax: "expr != expr",
		examples: ['status != "archived"', "priority != 0"],
	};
}
