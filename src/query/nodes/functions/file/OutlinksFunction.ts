/**
 * outlinks() - Get files this file links to
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("OutlinksNode", {function: "outlinks"})
export class OutlinksFunction extends FunctionExprNode {
	static minArity = 0;
	static maxArity = 0;
	static documentation: NodeDoc = {
		title: "outlinks",
		description: "Get list of files that the current file links to.",
		syntax: "outlinks()",
		returnType: "array",
		examples: ["length(outlinks()) > 0"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const metadata = ctx.env.getFileMetadata(ctx.filePath);
		if (!metadata) return [];
		return metadata.links;
	}
}
