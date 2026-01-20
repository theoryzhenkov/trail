/**
 * format(date, pattern) - Format date as string
 */

import {FunctionNode, func, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

@func("format")
export class FormatFunction extends FunctionNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "format",
		description: "Format date as string. Supports: YYYY, MM, DD, HH, mm, ss.",
		syntax: "format(date, pattern)",
		returnType: "string",
		examples: ['format(due, "YYYY-MM-DD")', 'format(time, "HH:mm")'],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		const pattern = toString(args[1] ?? null);
		
		if (!(value instanceof Date)) {
			return null;
		}

		const pad = (n: number): string => n.toString().padStart(2, "0");

		return pattern
			.replace("YYYY", value.getFullYear().toString())
			.replace("MM", pad(value.getMonth() + 1))
			.replace("DD", pad(value.getDate()))
			.replace("HH", pad(value.getHours()))
			.replace("mm", pad(value.getMinutes()))
			.replace("ss", pad(value.getSeconds()));
	}
}
