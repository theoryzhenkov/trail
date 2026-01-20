/**
 * PRUNE keyword token
 */

import {TokenNode} from "../../base/TokenNode";
import {register} from "../../registry";

@register("PruneToken", {keyword: "prune"})
export class PruneToken extends TokenNode {
	static keyword = "prune";
	static highlighting = "keyword" as const;
}
