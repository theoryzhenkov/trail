/**
 * contains(haystack, needle) - Check if string contains substring
 */

import {FunctionNode, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class ContainsFunction extends FunctionNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "contains",
		description: "Check if string contains substring (case-sensitive).",
		syntax: "contains(haystack, needle)",
		returnType: "boolean",
		examples: ['contains(title, "draft")', 'contains(file.name, "project")'],
	};

	static evaluate(args: Value[]): Value {
		const haystack = toString(args[0] ?? null);
		const needle = toString(args[1] ?? null);
		return haystack.includes(needle);
	}
}
