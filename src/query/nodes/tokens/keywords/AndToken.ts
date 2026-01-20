/**
 * AND keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("AndToken", {keyword: "and"})
export class AndToken extends TokenNode {
	static keyword = "and";
	static highlighting = "operatorKeyword" as const;
	static documentation: NodeDoc = {
		title: "AND operator",
		description: "Logical AND. Both conditions must be true.",
		syntax: "Expr and Expr",
		examples: ['status = "active" and priority > 3', 'hasTag("work") and file.folder = "Projects"'],
	};
	static completable: Completable = {
		keywords: ["and"],
		context: "after-expression",
		priority: 90,
		category: "operator",
	};
}
