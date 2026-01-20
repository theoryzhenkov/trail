/**
 * Less Than or Equal (<=) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class LtEqToken extends TokenNode {
	static keyword = "<=";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: "<= (less than or equal)",
		description: "Less than or equal comparison.",
		syntax: "expr <= expr",
		examples: ["priority <= 5", "due <= endOfWeek"],
	};
}
