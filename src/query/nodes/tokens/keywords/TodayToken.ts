/**
 * TODAY keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("TodayToken", {keyword: "today"})
export class TodayToken extends TokenNode {
	static keyword = "today";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "today",
		description: "Current date at midnight. Supports arithmetic with durations.",
		examples: ["date = today", "date > today - 7d"],
	};
	static completable: Completable = {
		keywords: ["today"],
		context: "expression",
		priority: 50,
		category: "value",
	};
}
