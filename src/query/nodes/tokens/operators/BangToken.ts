/**
 * Bang (!) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("Bang", {keyword: "!"})
export class BangToken extends TokenNode {
	static keyword = "!";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: "! (not)",
		description: "Logical NOT. Same as 'not' keyword.",
		syntax: "!expr",
		examples: ['!hasTag("private")', "!active"],
	};
}
