/**
 * UNLIMITED keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("Unlimited", {keyword: "unlimited"})
export class UnlimitedToken extends TokenNode {
	static keyword = "unlimited";
	static highlighting = "typeName" as const;
	static documentation: NodeDoc = {
		title: "unlimited",
		description: "Traverse to any depth with no limit. This is the default if depth is not specified.",
		examples: ["from up depth unlimited"],
	};
}
