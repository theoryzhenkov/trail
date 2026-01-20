/**
 * Bang (!) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

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
