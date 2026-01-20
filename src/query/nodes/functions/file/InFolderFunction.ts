/**
 * inFolder(folder) - Check if file is in folder
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("InFolderNode", {function: "inFolder"})
export class InFolderFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "inFolder",
		description: "Check if current file is in the specified folder (or a subfolder).",
		syntax: "inFolder(folder)",
		returnType: "boolean",
		examples: ['inFolder("Projects")', 'inFolder("Archive/2024")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: ExecutorContext): Value {
		const args = this.evaluateArgs(ctx);
		const folder = toString(args[0] ?? null);
		const metadata = ctx.getFileMetadata(ctx.filePath);
		if (!metadata) return false;

		const fileFolder = metadata.folder;
		// Check if file is in the folder or a subfolder
		return fileFolder === folder || fileFolder.startsWith(folder + "/");
	}
}
