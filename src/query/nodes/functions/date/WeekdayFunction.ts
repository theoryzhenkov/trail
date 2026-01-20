/**
 * weekday(date) - Get day of week (0=Sun, 6=Sat)
 */

import {FunctionNode} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class WeekdayFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "weekday",
		description: "Get day of week (0=Sunday, 6=Saturday).",
		syntax: "weekday(date)",
		returnType: "number",
		examples: ["weekday(due) = 1  // Monday"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getDay();
		}
		return null;
	}
}
