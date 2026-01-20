/**
 * Comma token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("Comma", {keyword: ","})
export class CommaToken extends TokenNode {
	static keyword = ",";
	static highlighting = "punctuation" as const;
}
