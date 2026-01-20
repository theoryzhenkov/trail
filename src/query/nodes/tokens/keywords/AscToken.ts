/**
 * ASC keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("AscToken", {keyword: "asc"})
export class AscToken extends TokenNode {
	static keyword = "asc";
	static highlighting = "typeName" as const;
}
