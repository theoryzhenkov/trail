/**
 * NOT keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("NotToken", {keyword: "not"})
export class NotToken extends TokenNode {
	static keyword = "not";
	static highlighting = "operatorKeyword" as const;
}
