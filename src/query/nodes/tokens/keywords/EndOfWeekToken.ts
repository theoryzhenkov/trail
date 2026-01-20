/**
 * ENDOFWEEK keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class EndOfWeekToken extends TokenNode {
	static keyword = "endOfWeek";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "endOfWeek",
		description: "Last day of the current week (Saturday) at midnight.",
		examples: ["due <= endOfWeek"],
	};
}
