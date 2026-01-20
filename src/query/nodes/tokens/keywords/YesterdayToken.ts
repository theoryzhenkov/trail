/**
 * YESTERDAY keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class YesterdayToken extends TokenNode {
	static keyword = "yesterday";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "yesterday",
		description: "Previous day at midnight.",
		examples: ["date = yesterday", "created > yesterday"],
	};
}
