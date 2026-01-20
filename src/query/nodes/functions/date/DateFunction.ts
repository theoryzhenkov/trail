/**
 * date(string) - Parse string to date
 */

import {FunctionNode, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class DateFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "date",
		description: "Parse string to date.",
		syntax: "date(string)",
		returnType: "date",
		examples: ['date("2024-01-15")', "date(created_string)"],
	};

	static evaluate(args: Value[]): Value {
		const str = toString(args[0] ?? null);
		const date = new Date(str);
		return isNaN(date.getTime()) ? null : date;
	}
}
