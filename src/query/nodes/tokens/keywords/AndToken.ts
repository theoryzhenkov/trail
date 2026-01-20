/**
 * AND keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("AndToken", {keyword: "and"})
export class AndToken extends TokenNode {
	static keyword = "and";
	static highlighting = "operatorKeyword" as const;
}
