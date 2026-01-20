/**
 * isEmpty(array) - Check if array is empty
 */

import {FunctionNode, func} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

@func("isEmpty")
export class IsEmptyFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "isEmpty",
		description: "Check if array is empty.",
		syntax: "isEmpty(array)",
		returnType: "boolean",
		examples: ["isEmpty(tags)", "not isEmpty(children)"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (value === null) return true;
		if (Array.isArray(value)) return value.length === 0;
		if (typeof value === "string") return value.length === 0;
		return true;
	}
}
