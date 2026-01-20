/**
 * GROUP keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("GroupToken", {keyword: "group"})
export class GroupToken extends TokenNode {
	static keyword = "group";
	static highlighting = "keyword" as const;
}
