/**
 * WHEN keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";
import type {NodeDoc} from "../../types";

@register("When", {keyword: "when"})
export class WhenToken extends TokenNode {
	static keyword = "when";
	static highlighting = "keyword" as const;
	static documentation: NodeDoc = {
		title: "WHEN clause",
		description: "Conditional visibility for the entire group. If the active file doesn't match, the group is hidden.",
		syntax: "when Expression",
		examples: [
			'when type = "project"',
			'when hasTag("daily")',
			'when file.folder = "Projects"',
		],
	};
}
