/**
 * inFolder(folder) - Check if file is in folder
 */

import {FunctionNode, func, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";
import type {ExecutorContext} from "../../context";

@func("inFolder")
export class InFolderFunction extends FunctionNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "inFolder",
		description: "Check if current file is in the specified folder (or a subfolder).",
		syntax: "inFolder(folder)",
		returnType: "boolean",
		examples: ['inFolder("Projects")', 'inFolder("Archive/2024")'],
	};

	static evaluate(args: Value[], ctx: ExecutorContext): Value {
		const folder = toString(args[0] ?? null);
		const metadata = ctx.getFileMetadata(ctx.filePath);
		if (!metadata) return false;
		
		const fileFolder = metadata.folder;
		// Check if file is in the folder or a subfolder
		return fileFolder === folder || fileFolder.startsWith(folder + "/");
	}
}
