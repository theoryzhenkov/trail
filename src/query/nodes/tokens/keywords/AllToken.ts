/**
 * ALL keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("AllToken", {keyword: "all"})
export class AllToken extends TokenNode {
	static keyword = "all";
	static highlighting = "typeName" as const;
}
