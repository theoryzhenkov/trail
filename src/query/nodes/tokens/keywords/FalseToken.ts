/**
 * FALSE keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("FalseToken", {keyword: "false"})
export class FalseToken extends TokenNode {
	static keyword = "false";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "false",
		description: "Boolean false literal.",
		examples: ["where active = false", "where draft != false"],
	};
}
