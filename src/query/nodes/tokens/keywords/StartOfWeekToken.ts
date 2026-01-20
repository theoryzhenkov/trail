/**
 * STARTOFWEEK keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("StartOfWeekToken", {keyword: "startofweek"})
export class StartOfWeekToken extends TokenNode {
	static keyword = "startOfWeek";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "startOfWeek",
		description: "First day of the current week (Sunday) at midnight.",
		examples: ["date >= startOfWeek", "modified > startOfWeek"],
	};
	static completable: Completable = {
		keywords: ["startOfWeek"],
		context: "expression",
		priority: 35,
		category: "value",
	};
}
