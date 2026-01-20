/**
 * trim(str) - Remove leading/trailing whitespace
 */

import {FunctionNode, func, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

@func("trim")
export class TrimFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "trim",
		description: "Remove leading and trailing whitespace.",
		syntax: "trim(string)",
		returnType: "string",
		examples: ["trim(title)"],
	};

	static evaluate(args: Value[]): Value {
		return toString(args[0] ?? null).trim();
	}
}
