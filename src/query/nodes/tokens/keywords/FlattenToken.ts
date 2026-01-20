/**
 * FLATTEN keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("FlattenToken", {keyword: "flatten"})
export class FlattenToken extends TokenNode {
	static keyword = "flatten";
	static highlighting = "typeName" as const;
}
