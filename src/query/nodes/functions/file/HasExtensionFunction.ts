/**
 * hasExtension(ext) - Check file extension
 */

import {FunctionNode, func, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";
import type {ExecutorContext} from "../../context";

@func("hasExtension")
export class HasExtensionFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "hasExtension",
		description: "Check if file has the specified extension.",
		syntax: "hasExtension(ext)",
		returnType: "boolean",
		examples: ['hasExtension("md")', 'hasExtension("pdf")'],
	};

	static evaluate(args: Value[], ctx: ExecutorContext): Value {
		const ext = toString(args[0] ?? null).toLowerCase();
		const path = ctx.filePath.toLowerCase();
		const expectedExt = ext.startsWith(".") ? ext : "." + ext;
		return path.endsWith(expectedExt);
	}
}
