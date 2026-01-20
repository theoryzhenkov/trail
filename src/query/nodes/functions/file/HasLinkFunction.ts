/**
 * hasLink(target) - Check if file links to target
 */

import {FunctionNode, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";
import type {ExecutorContext} from "../../context";

export class HasLinkFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "hasLink",
		description: "Check if file contains a link to the specified target.",
		syntax: "hasLink(target)",
		returnType: "boolean",
		examples: ['hasLink("Index")', 'hasLink("Projects/Main")'],
	};

	static evaluate(args: Value[], ctx: ExecutorContext): Value {
		const target = toString(args[0] ?? null).toLowerCase();
		const metadata = ctx.getFileMetadata(ctx.filePath);
		if (!metadata) return false;
		
		return metadata.links.some(link => link.toLowerCase().includes(target));
	}
}
