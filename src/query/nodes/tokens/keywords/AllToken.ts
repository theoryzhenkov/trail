/**
 * ALL keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class AllToken extends TokenNode {
	static keyword = "all";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "all",
		description: "Display all frontmatter properties. Can be combined with specific file.* properties.",
		examples: ["display all", "display all, file.created"],
	};
}
