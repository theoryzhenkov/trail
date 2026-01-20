/**
 * tags() - Get all tags from file
 */

import {FunctionNode, func} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";
import type {ExecutorContext} from "../../context";

@func("tags")
export class TagsFunction extends FunctionNode {
	static minArity = 0;
	static maxArity = 0;
	static documentation: NodeDoc = {
		title: "tags",
		description: "Get all tags from the current file.",
		syntax: "tags()",
		returnType: "array",
		examples: ['"project" in tags()', "length(tags()) > 0"],
	};

	static evaluate(_args: Value[], ctx: ExecutorContext): Value {
		const metadata = ctx.getFileMetadata(ctx.filePath);
		if (!metadata) return [];
		return metadata.tags;
	}
}
