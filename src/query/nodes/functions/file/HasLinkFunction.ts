/**
 * hasLink(target) - Check if file links to target
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("HasLinkNode", {function: "hasLink"})
export class HasLinkFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "hasLink",
		description: "Check if file contains a link to the specified target.",
		syntax: "hasLink(target)",
		returnType: "boolean",
		examples: ['hasLink("Index")', 'hasLink("Projects/Main")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const target = toString(args[0] ?? null).toLowerCase();
		const metadata = ctx.getFileMetadata(ctx.filePath);
		if (!metadata) return false;

		return metadata.links.some((link) => link.toLowerCase().includes(target));
	}
}
