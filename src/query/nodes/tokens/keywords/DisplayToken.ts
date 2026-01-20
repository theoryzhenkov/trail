/**
 * DISPLAY keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("DisplayToken", {keyword: "display"})
export class DisplayToken extends TokenNode {
	static keyword = "display";
	static highlighting = "keyword" as const;
}
