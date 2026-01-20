/**
 * ASC keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class AscToken extends TokenNode {
	static keyword = "asc";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "asc",
		description: "Ascending sort order (A-Z, 0-9, oldest first). This is the default.",
		examples: ["sort priority asc", "sort $file.name asc"],
	};
}
