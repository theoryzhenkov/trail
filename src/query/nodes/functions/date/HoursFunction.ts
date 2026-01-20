/**
 * hours(date) - Get hours from date
 */

import {FunctionNode, func} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

@func("hours")
export class HoursFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "hours",
		description: "Get hours from date (0-23).",
		syntax: "hours(date)",
		returnType: "number",
		examples: ["hours(file.modified) < 12  // morning"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getHours();
		}
		return null;
	}
}
