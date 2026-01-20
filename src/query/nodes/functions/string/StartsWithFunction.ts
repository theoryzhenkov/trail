/**
 * startsWith(str, prefix) - Check if string starts with prefix
 */

import {FunctionNode, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class StartsWithFunction extends FunctionNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "startsWith",
		description: "Check if string starts with prefix.",
		syntax: "startsWith(string, prefix)",
		returnType: "boolean",
		examples: ['startsWith(file.name, "2024")'],
	};

	static evaluate(args: Value[]): Value {
		const str = toString(args[0] ?? null);
		const prefix = toString(args[1] ?? null);
		return str.startsWith(prefix);
	}
}
