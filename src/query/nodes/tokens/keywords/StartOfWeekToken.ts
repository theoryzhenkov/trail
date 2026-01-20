/**
 * STARTOFWEEK keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class StartOfWeekToken extends TokenNode {
	static keyword = "startOfWeek";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "startOfWeek",
		description: "First day of the current week (Sunday) at midnight.",
		examples: ["date >= startOfWeek", "modified > startOfWeek"],
	};
}
