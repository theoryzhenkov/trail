/**
 * DESC keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class DescToken extends TokenNode {
	static keyword = "desc";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "desc",
		description: "Descending sort order (Z-A, 9-0, newest first).",
		examples: ["sort by date desc", "sort by priority desc"],
	};
}
