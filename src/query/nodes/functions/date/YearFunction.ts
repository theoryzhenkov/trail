/**
 * year(date) - Get year from date
 */

import {FunctionNode} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class YearFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "year",
		description: "Get year from date.",
		syntax: "year(date)",
		returnType: "number",
		examples: ["year(file.created) = 2024"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0] ?? null;
		if (value instanceof Date) {
			return value.getFullYear();
		}
		return null;
	}
}
