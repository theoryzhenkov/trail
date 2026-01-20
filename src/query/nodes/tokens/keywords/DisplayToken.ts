/**
 * DISPLAY keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc, Completable} from "../../types";

export class DisplayToken extends TokenNode {
	static keyword = "display";
	static highlighting = "keyword" as const;
	static documentation: NodeDoc = {
		title: "DISPLAY clause",
		description: "Specifies which properties to show in the Trail pane UI.",
		syntax: "display Property, ... | all [, Property, ...]",
		examples: [
			"display status, priority",
			"display all",
			"display all, file.modified",
		],
	};
	static completable: Completable = {
		keywords: ["display"],
		context: "clause",
		priority: 40,
		category: "keyword",
	};
}
