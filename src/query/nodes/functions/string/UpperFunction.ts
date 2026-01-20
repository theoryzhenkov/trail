/**
 * upper(str) - Convert to uppercase
 */

import {FunctionNode, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class UpperFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "upper",
		description: "Convert string to uppercase.",
		syntax: "upper(string)",
		returnType: "string",
		examples: ['upper(type) = "PROJECT"'],
	};

	static evaluate(args: Value[]): Value {
		return toString(args[0] ?? null).toUpperCase();
	}
}
