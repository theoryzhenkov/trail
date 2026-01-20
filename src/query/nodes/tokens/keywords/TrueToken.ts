/**
 * TRUE keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class TrueToken extends TokenNode {
	static keyword = "true";
	static highlighting = "atom" as const;
	static documentation: NodeDoc = {
		title: "true",
		description: "Boolean true literal.",
		examples: ["where active = true", "prune archived = true"],
	};
}
