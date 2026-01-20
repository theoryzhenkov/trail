/**
 * ALL keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("All", {keyword: "all"})
export class AllToken extends TokenNode {
	static keyword = "all";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "all",
		description: "Display all frontmatter properties. Can be combined with specific file.* properties.",
		examples: ["display all", "display all, file.created"],
	};
}
