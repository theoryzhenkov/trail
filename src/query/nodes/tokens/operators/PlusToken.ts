/**
 * Plus (+) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

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
