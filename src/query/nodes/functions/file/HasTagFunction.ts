/**
 * hasTag(tag) - Check if file has tag
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("HasTagNode", {function: "hasTag"})
export class HasTagFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "hasTag",
		description: "Check if file has the specified tag.",
		syntax: "hasTag(tag)",
		returnType: "boolean",
		examples: ['hasTag("project")', 'hasTag("active")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const tag = toString(args[0] ?? null);
		const metadata = ctx.getFileMetadata(ctx.filePath);
		if (!metadata) return false;

		// Normalize tag (remove leading # if present)
		const normalizedTag = tag.startsWith("#") ? tag.slice(1) : tag;

		return metadata.tags.some((t) => {
			const normalizedT = t.startsWith("#") ? t.slice(1) : t;
			return normalizedT.toLowerCase() === normalizedTag.toLowerCase();
		});
	}
}
