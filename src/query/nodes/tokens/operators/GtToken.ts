/**
 * Greater Than (>) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class GtToken extends TokenNode {
	static keyword = ">";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: "> (greater than)",
		description: "Greater than comparison. Works with numbers, strings, and dates.",
		syntax: "expr > expr",
		examples: ["priority > 3", "date > yesterday"],
	};
}
