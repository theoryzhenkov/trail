/**
 * Plus (+) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("Plus", {keyword: "+"})
export class PlusToken extends TokenNode {
	static keyword = "+";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: "+ (plus)",
		description: "Addition for numbers, concatenation for strings, date + duration arithmetic.",
		syntax: "expr + expr",
		examples: ["priority + 1", "today + 7d", 'name + " suffix"'],
	};
}
