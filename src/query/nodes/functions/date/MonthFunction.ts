/**
 * month(date) - Get month from date (1-12)
 */

import {FunctionNode, func} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

@func("month")
export class MonthFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "month",
		description: "Get month from date (1-12).",
		syntax: "month(date)",
		returnType: "number",
		examples: ["month(due) = 6"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getMonth() + 1; // JavaScript months are 0-indexed
		}
		return null;
	}
}
