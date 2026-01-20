/**
 * Right Parenthesis token
 */

import {TokenNode} from "../../base/TokenNode";

export class RParenToken extends TokenNode {
	static keyword = ")";
	static highlighting = "punctuation" as const;
}
