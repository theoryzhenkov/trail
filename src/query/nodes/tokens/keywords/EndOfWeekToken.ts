/**
 * ENDOFWEEK keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("EndOfWeekToken", {keyword: "endofweek"})
export class EndOfWeekToken extends TokenNode {
	static keyword = "endOfWeek";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "endOfWeek",
		description: "Last day of the current week (Saturday) at midnight.",
		examples: ["due <= endOfWeek"],
	};
	static completable: Completable = {
		keywords: ["endOfWeek"],
		context: "expression",
		priority: 35,
		category: "value",
	};
}
