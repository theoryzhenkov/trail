/**
 * exists(value) - Check if value is not null
 */

import {FunctionNode, func} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

@func("exists")
export class ExistsFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "exists",
		description: "Check if value is not null/undefined.",
		syntax: "exists(value)",
		returnType: "boolean",
		examples: ["exists(due)", "exists(priority)"],
	};

	static evaluate(args: Value[]): Value {
		const value = args[0];
		return value !== null && value !== undefined;
	}
}
