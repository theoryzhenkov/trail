/**
 * tags() - Get all tags from file
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("TagsNode", {function: "tags"})
export class TagsFunction extends FunctionExprNode {
	static minArity = 0;
	static maxArity = 0;
	static documentation: NodeDoc = {
		title: "tags",
		description: "Get all tags from the current file.",
		syntax: "tags()",
		returnType: "array",
		examples: ['"project" in tags()', "length(tags()) > 0"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const metadata = ctx.env.getFileMetadata(ctx.filePath);
		if (!metadata) return [];
		return metadata.tags;
	}
}
