/**
 * now() - Get current date and time
 */

import {FunctionNode} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class NowFunction extends FunctionNode {
	static minArity = 0;
	static maxArity = 0;
	static documentation: NodeDoc = {
		title: "now",
		description: "Get current date and time.",
		syntax: "now()",
		returnType: "date",
		examples: ["file.modified > now() - 7d"],
	};

	static evaluate(): Value {
		return new Date();
	}
}
