/**
 * GROUP keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class GroupToken extends TokenNode {
	static keyword = "group";
	static highlighting = "keyword" as const;
	static documentation: NodeDoc = {
		title: "GROUP clause",
		description: "Defines the name of this query group. Required as the first clause.",
		syntax: 'group "Name"',
		examples: ['group "Ancestors"', 'group "Related Projects"'],
	};
}
