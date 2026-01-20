/**
 * Left Parenthesis token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("LParen", {keyword: "("})
export class LParenToken extends TokenNode {
	static keyword = "(";
	static highlighting = "punctuation" as const;
}
