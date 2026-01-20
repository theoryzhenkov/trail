/**
 * Left Parenthesis token
 */

import {TokenNode} from "../../base/TokenNode";

export class LParenToken extends TokenNode {
	static keyword = "(";
	static highlighting = "punctuation" as const;
}
