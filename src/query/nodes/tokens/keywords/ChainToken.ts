/**
 * CHAIN keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class ChainToken extends TokenNode {
	static keyword = "chain";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "chain sort",
		description: "Sorts by sequence position for sequential relations (next/prev). Only meaningful in sort clause.",
		examples: ["sort by chain", "sort by chain, date desc"],
	};
}
