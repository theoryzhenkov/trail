/**
 * Null-safe Equals (=?) operator token
 */

import {TokenNode} from "../../base/TokenNode";
import type {NodeDoc} from "../../types";

export class EqNullToken extends TokenNode {
	static keyword = "=?";
	static highlighting = "operator" as const;
	static documentation: NodeDoc = {
		title: "=? (null-safe equals)",
		description: "Null-safe equality. Returns false if left side is null, otherwise compares normally.",
		syntax: "expr =? expr",
		examples: ['status =? "active"  // false if status is null'],
	};
}
