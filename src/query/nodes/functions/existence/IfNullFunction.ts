/**
 * ifnull(value, default) - Return default if value is null
 */

import {FunctionNode} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class IfNullFunction extends FunctionNode {
	static minArity = 2;
	static maxArity = 2;
	static documentation: NodeDoc = {
		title: "ifnull",
		description: "Return default value if first argument is null.",
		syntax: "ifnull(value, default)",
		returnType: "any",
		examples: ['ifnull(status, "unknown")', "ifnull(priority, 0)"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0];
		const defaultValue = args[1] ?? null;
		return value !== null && value !== undefined ? value : defaultValue;
	}
}
