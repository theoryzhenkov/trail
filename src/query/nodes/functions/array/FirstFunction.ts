/**
 * first(array) - Get first element
 */

import {FunctionNode} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class FirstFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "first",
		description: "Get first element of array.",
		syntax: "first(array)",
		returnType: "any",
		examples: ['first(tags) = "important"'],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (Array.isArray(value) && value.length > 0) {
			return value[0] ?? null;
		}
		return null;
	}
}
