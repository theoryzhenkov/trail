/**
 * FALSE keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class FalseToken extends TokenNode {
	static keyword = "false";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "false",
		description: "Boolean false literal.",
		examples: ["where active = false", "where draft != false"],
	};
}
