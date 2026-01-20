/**
 * len(array) - Get array length
 */

import {FunctionNode} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class LenFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "len",
		description: "Get array length.",
		syntax: "len(array)",
		returnType: "number",
		examples: ["len(tags)", "len(children)"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (value === null) return 0;
		if (Array.isArray(value)) return value.length;
		if (typeof value === "string") return value.length;
		return 0;
	}
}
