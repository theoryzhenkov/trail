/**
 * matches(str, pattern, flags?) - Regex match
 */

import {FunctionNode, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class MatchesFunction extends FunctionNode {
	static minArity = 2;
	static maxArity = 3;
	static documentation: NodeDoc = {
		title: "matches",
		description: "Test string against regex pattern. Optional flags parameter.",
		syntax: "matches(string, pattern[, flags])",
		returnType: "boolean",
		examples: ['matches(title, "^\\\\d{4}")', 'matches(name, "test", "i")'],
	};

	static evaluate(args: Value[]): Value {
		const str = toString(args[0] ?? null);
		const pattern = toString(args[1] ?? null);
		const flags = args[2] !== undefined ? toString(args[2]) : "";
		try {
			const regex = new RegExp(pattern, flags);
			return regex.test(str);
		} catch {
			return false;
		}
	}
}
