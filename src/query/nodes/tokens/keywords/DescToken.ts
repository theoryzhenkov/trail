/**
 * DESC keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("DescToken", {keyword: "desc"})
export class DescToken extends TokenNode {
	static keyword = "desc";
	static highlighting = "typeName" as const;
}
