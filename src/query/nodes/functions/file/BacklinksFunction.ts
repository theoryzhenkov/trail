/**
 * backlinks() - Get files linking to this file
 */

import {FunctionExprNode} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("BacklinksNode", {function: "backlinks"})
export class BacklinksFunction extends FunctionExprNode {
	static minArity = 0;
	static maxArity = 0;
	static documentation: NodeDoc = {
		title: "backlinks",
		description: "Get list of files that link to the current file.",
		syntax: "backlinks()",
		returnType: "array",
		examples: ["length(backlinks()) > 5"],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const metadata = ctx.getFileMetadata(ctx.filePath);
		if (!metadata) return [];
		return metadata.backlinks;
	}
}
