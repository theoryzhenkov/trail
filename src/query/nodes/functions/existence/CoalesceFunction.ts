/**
 * coalesce(value1, value2, ...) - Return first non-null value
 */

import {FunctionNode} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class CoalesceFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = Infinity;
	static documentation: NodeDoc = {
		title: "coalesce",
		description: "Return first non-null value from arguments.",
		syntax: "coalesce(value1, value2, ...)",
		returnType: "any",
		examples: ["coalesce(alias, file.name)", "coalesce(due, created)"],
	};

	static evaluate(args: Value[]): Value {
		for (const arg of args) {
			if (arg !== null && arg !== undefined) {
				return arg;
			}
		}
		return null;
	}
}
