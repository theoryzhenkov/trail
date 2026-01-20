/**
 * FROM keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("From", {keyword: "from"})
export class FromToken extends TokenNode {
	static keyword = "from";
	static highlighting = "keyword" as const;
	static documentation: NodeDoc = {
		title: "FROM clause",
		description: "Specifies which relations to traverse. Supports multiple relations with depth and extend modifiers.",
		syntax: "from Relation [depth N|unlimited] [extend Group], ...",
		examples: [
			"from up depth unlimited",
			"from up, down depth 2",
			"from up extend Children depth 5",
		],
	};
}
