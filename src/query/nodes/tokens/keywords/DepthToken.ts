/**
 * DEPTH keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("DepthToken", {keyword: "depth"})
export class DepthToken extends TokenNode {
	static keyword = "depth";
	static highlighting = "typeName" as const;
}
