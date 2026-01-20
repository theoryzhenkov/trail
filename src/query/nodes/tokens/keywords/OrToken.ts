/**
 * OR keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("OrToken", {keyword: "or"})
export class OrToken extends TokenNode {
	static keyword = "or";
	static highlighting = "operatorKeyword" as const;
}
