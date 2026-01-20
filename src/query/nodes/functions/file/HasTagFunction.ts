/**
 * hasTag(tag) - Check if file has tag
 */

import {FunctionNode, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";
import type {ExecutorContext} from "../../context";

export class HasTagFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "hasTag",
		description: "Check if file has the specified tag.",
		syntax: "hasTag(tag)",
		returnType: "boolean",
		examples: ['hasTag("project")', 'hasTag("active")'],
	};

	static evaluate(args: Value[], ctx: ExecutorContext): Value {
		const tag = toString(args[0] ?? null);
		const metadata = ctx.getFileMetadata(ctx.filePath);
		if (!metadata) return false;
		
		// Normalize tag (remove leading # if present)
		const normalizedTag = tag.startsWith("#") ? tag.slice(1) : tag;
		
		return metadata.tags.some(t => {
			const normalizedT = t.startsWith("#") ? t.slice(1) : t;
			return normalizedT.toLowerCase() === normalizedTag.toLowerCase();
		});
	}
}
