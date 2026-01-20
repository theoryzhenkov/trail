/**
 * Minus (-) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("Minus", {keyword: "-"})
export class MinusToken extends TokenNode {
	static keyword = "-";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: "- (minus)",
		description: "Subtraction for numbers, date - duration arithmetic.",
		syntax: "expr - expr",
		examples: ["priority - 1", "today - 7d"],
	};
}
