/**
 * Dot token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("Dot", {keyword: "."})
export class DotToken extends TokenNode {
	static keyword = ".";
	static highlighting = "punctuation" as const;
}
