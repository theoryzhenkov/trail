/**
 * last(array) - Get last element
 */

import {FunctionNode} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class LastFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "last",
		description: "Get last element of array.",
		syntax: "last(array)",
		returnType: "any",
		examples: ["last(path_parts)"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (Array.isArray(value) && value.length > 0) {
			return value[value.length - 1] ?? null;
		}
		return null;
	}
}
