/**
 * Dot token
 */

import {TokenNode} from "../../base/TokenNode";

export class DotToken extends TokenNode {
	static keyword = ".";
	static highlighting = "punctuation" as const;
}
