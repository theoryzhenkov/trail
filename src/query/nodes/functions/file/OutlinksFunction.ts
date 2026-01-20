/**
 * outlinks() - Get files this file links to
 */

import {FunctionNode, func} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";
import type {ExecutorContext} from "../../context";

@func("outlinks")
export class OutlinksFunction extends FunctionNode {
	static minArity = 0;
	static maxArity = 0;
	static documentation: NodeDoc = {
		title: "outlinks",
		description: "Get list of files that the current file links to.",
		syntax: "outlinks()",
		returnType: "array",
		examples: ["length(outlinks()) > 0"],
	};

	static evaluate(_args: Value[], ctx: ExecutorContext): Value {
		const metadata = ctx.getFileMetadata(ctx.filePath);
		if (!metadata) return [];
		return metadata.links;
	}
}
