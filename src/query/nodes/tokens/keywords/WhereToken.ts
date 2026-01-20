/**
 * WHERE keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("WhereToken", {keyword: "where"})
export class WhereToken extends TokenNode {
	static keyword = "where";
	static highlighting = "keyword" as const;
}
