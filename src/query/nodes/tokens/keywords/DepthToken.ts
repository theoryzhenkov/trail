/**
 * DEPTH modifier token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class DepthToken extends TokenNode {
	static keyword = "depth";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "depth modifier",
		description: "Sets how many levels to traverse for a relation. Use a number or 'unlimited'.",
		syntax: "depth N | depth unlimited",
		examples: ["from up depth 3", "from down depth unlimited"],
	};
}
