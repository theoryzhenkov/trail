/**
 * day(date) - Get day of month from date
 */

import {FunctionNode, func} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

@func("day")
export class DayFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "day",
		description: "Get day of month from date.",
		syntax: "day(date)",
		returnType: "number",
		examples: ["day(due) = 15"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getDate();
		}
		return null;
	}
}
