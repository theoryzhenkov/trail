/**
 * Greater Than or Equal (>=) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class GtEqToken extends TokenNode {
	static keyword = ">=";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: ">= (greater than or equal)",
		description: "Greater than or equal comparison.",
		syntax: "expr >= expr",
		examples: ["priority >= 3", "date >= startOfWeek"],
	};
}
