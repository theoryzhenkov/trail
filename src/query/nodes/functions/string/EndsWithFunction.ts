/**
 * endsWith(str, suffix) - Check if string ends with suffix
 */

import {FunctionNode, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class EndsWithFunction extends FunctionNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "endsWith",
		description: "Check if string ends with suffix.",
		syntax: "endsWith(string, suffix)",
		returnType: "boolean",
		examples: ['endsWith(file.name, "2024")'],
	};

	static evaluate(args: Value[]): Value {
		const str = toString(args[0] ?? null);
		const suffix = toString(args[1] ?? null);
		return str.endsWith(suffix);
	}
}
