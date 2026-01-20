/**
 * Range (..) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("DotDot", {keyword: ".."})
export class DotDotToken extends TokenNode {
	static keyword = "..";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: ".. (range)",
		description: "Creates a range for 'in' expressions. Inclusive on both ends.",
		syntax: "value in lower..upper",
		examples: ["priority in 1..5", "date in startOfWeek..endOfWeek"],
	};
}
