/**
 * Range (..) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

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
