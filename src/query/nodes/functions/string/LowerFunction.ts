/**
 * lower(str) - Convert to lowercase
 */

import {FunctionNode, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class LowerFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "lower",
		description: "Convert string to lowercase.",
		syntax: "lower(string)",
		returnType: "string",
		examples: ['lower(status) = "active"'],
	};

	static evaluate(args: Value[]): Value {
		return toString(args[0] ?? null).toLowerCase();
	}
}
