/**
 * WHEN keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("WhenToken", {keyword: "when"})
export class WhenToken extends TokenNode {
	static keyword = "when";
	static highlighting = "keyword" as const;
}
