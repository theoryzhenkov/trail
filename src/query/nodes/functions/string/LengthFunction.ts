/**
 * length(str) - Get string length
 */

import {FunctionNode, func, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

@func("length")
export class LengthFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "length",
		description: "Get string length. Also works on arrays.",
		syntax: "length(string)",
		returnType: "number",
		examples: ["length(title)", "length(tags)"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (value === null) return 0;
		if (typeof value === "string") return value.length;
		if (Array.isArray(value)) return value.length;
		return toString(value).length;
	}
}
