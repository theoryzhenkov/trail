/**
 * Right Parenthesis token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("RParen", {keyword: ")"})
export class RParenToken extends TokenNode {
	static keyword = ")";
	static highlighting = "punctuation" as const;
}
