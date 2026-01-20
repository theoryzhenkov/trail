/**
 * FROM keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("FromToken", {keyword: "from"})
export class FromToken extends TokenNode {
	static keyword = "from";
	static highlighting = "keyword" as const;
}
