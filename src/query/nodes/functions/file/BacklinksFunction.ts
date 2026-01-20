/**
 * backlinks() - Get files linking to this file
 */

import {FunctionNode, func} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";
import type {ExecutorContext} from "../../context";

@func("backlinks")
export class BacklinksFunction extends FunctionNode {
	static minArity = 0;
	static maxArity = 0;
	static documentation: NodeDoc = {
		title: "backlinks",
		description: "Get list of files that link to the current file.",
		syntax: "backlinks()",
		returnType: "array",
		examples: ["length(backlinks()) > 5"],
	};

	static evaluate(_args: Value[], ctx: ExecutorContext): Value {
		const metadata = ctx.getFileMetadata(ctx.filePath);
		if (!metadata) return [];
		return metadata.backlinks;
	}
}
