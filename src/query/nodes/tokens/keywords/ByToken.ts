/**
 * BY keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class ByToken extends TokenNode {
	static keyword = "by";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "by keyword",
		description: "Used after 'sort' to introduce sort keys.",
		syntax: "sort by Key [asc|desc], ...",
		examples: ["sort by date desc", "sort by chain, priority"],
	};
}
