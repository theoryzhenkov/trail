/**
 * EXTEND keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("ExtendToken", {keyword: "extend"})
export class ExtendToken extends TokenNode {
	static keyword = "extend";
	static highlighting = "typeName" as const;
}
