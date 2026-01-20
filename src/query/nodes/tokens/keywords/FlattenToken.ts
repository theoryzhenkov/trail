/**
 * FLATTEN modifier token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class FlattenToken extends TokenNode {
	static keyword = "flatten";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "flatten modifier",
		description: "Output all reachable nodes as a flat list at depth 1, instead of a nested tree structure. Useful for symmetric relations like 'same' that form cliques.",
		syntax: "Relation [depth N|unlimited] flatten",
		examples: ["from same depth unlimited flatten", "from down depth 2 flatten"],
	};
}
