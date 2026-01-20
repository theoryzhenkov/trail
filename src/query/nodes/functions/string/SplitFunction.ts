/**
 * split(str, delimiter) - Split string into array
 */

import {FunctionNode, func, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

@func("split")
export class SplitFunction extends FunctionNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "split",
		description: "Split string into array by delimiter.",
		syntax: "split(string, delimiter)",
		returnType: "array",
		examples: ['split(path, "/")', 'split(tags_string, ",")'],
	};

	static evaluate(args: Value[]): Value {
		const str = toString(args[0] ?? null);
		const delimiter = toString(args[1] ?? null);
		return str.split(delimiter);
	}
}
