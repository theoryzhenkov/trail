/**
 * TODAY keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("Today", {keyword: "today"})
export class TodayToken extends TokenNode {
	static keyword = "today";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "today",
		description: "Current date at midnight. Supports arithmetic with durations.",
		examples: ["date = today", "date > today - 7d"],
	};
}
