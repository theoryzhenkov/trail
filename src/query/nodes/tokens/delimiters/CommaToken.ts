/**
 * Comma token
 */

import {TokenNode} from "../../base/TokenNode";

export class CommaToken extends TokenNode {
	static keyword = ",";
	static highlighting = "punctuation" as const;
}
