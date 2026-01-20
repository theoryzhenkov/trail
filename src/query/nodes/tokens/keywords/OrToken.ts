/**
 * OR keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("OrToken", {keyword: "or"})
export class OrToken extends TokenNode {
	static keyword = "or";
	static highlighting = "operatorKeyword" as const;
	static documentation: NodeDoc = {
		title: "OR operator",
		description: "Logical OR. At least one condition must be true.",
		syntax: "Expr or Expr",
		examples: ['type = "note" or type = "project"', 'priority > 5 or hasTag("urgent")'],
	};
	static completable: Completable = {
		keywords: ["or"],
		context: "after-expression",
		priority: 90,
		category: "operator",
	};
}
