/**
 * minutes(date) - Get minutes from date
 */

import {FunctionNode} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class MinutesFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "minutes",
		description: "Get minutes from date (0-59).",
		syntax: "minutes(date)",
		returnType: "number",
		examples: ["minutes(time)"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getMinutes();
		}
		return null;
	}
}
