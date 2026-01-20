/**
 * IN keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("InToken", {keyword: "in"})
export class InToken extends TokenNode {
	static keyword = "in";
	static highlighting = "operatorKeyword" as const;
}
