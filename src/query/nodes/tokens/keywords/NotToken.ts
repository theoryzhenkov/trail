/**
 * NOT keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc, Completable} from "../../types";

@register("NotToken", {keyword: "not"})
export class NotToken extends TokenNode {
	static keyword = "not";
	static highlighting = "operatorKeyword" as const;
	static documentation: NodeDoc = {
		title: "NOT operator",
		description: "Logical NOT. Inverts the condition. Can also use '!' prefix.",
		syntax: "not Expr | !Expr",
		examples: ['not status = "archived"', '!hasTag("private")'],
	};
	static completable: Completable = {
		keywords: ["not"],
		context: "expression",
		priority: 80,
		category: "operator",
	};
}
