/**
 * OR keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class OrToken extends TokenNode {
	static keyword = "or";
	static highlighting = "operatorKeyword" as const;
	static documentation: NodeDoc = {
		title: "OR operator",
		description: "Logical OR. At least one condition must be true.",
		syntax: "Expr or Expr",
		examples: ['type = "note" or type = "project"', 'priority > 5 or hasTag("urgent")'],
	};
}
