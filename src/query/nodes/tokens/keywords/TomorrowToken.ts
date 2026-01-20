/**
 * TOMORROW keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class TomorrowToken extends TokenNode {
	static keyword = "tomorrow";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "tomorrow",
		description: "Next day at midnight.",
		examples: ["due = tomorrow", "due < tomorrow + 7d"],
	};
}
