/**
 * File Built-in Functions
 */

import type {Value} from "../ast";
import type {BuiltinFunction, FunctionContext} from "./index";

function toString(value: Value): string {
	if (value === null) return "";
	if (typeof value === "string") return value;
	return String(value);
}

export const fileFunctions: Record<string, BuiltinFunction> = {
	/**
	 * inFolder(folderPath) - Check if current file is in folder
	 */
	inFolder: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[], ctx: FunctionContext): Value => {
			const folderPath = toString(args[0] ?? null);
			const metadata = ctx.getFileMetadata(ctx.filePath);
			if (!metadata) return false;
			
			// Normalize paths for comparison
			const normalizedFolder = folderPath.replace(/\/$/, "");
			const fileFolder = metadata.folder.replace(/\/$/, "");
			
			return fileFolder === normalizedFolder || fileFolder.startsWith(normalizedFolder + "/");
		},
	},

	/**
	 * hasExtension(ext) - Check if file has extension
	 */
	hasExtension: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[], ctx: FunctionContext): Value => {
			const ext = toString(args[0] ?? null).replace(/^\./, "");
			return ctx.filePath.endsWith("." + ext);
		},
	},

	/**
	 * hasTag(tag) - Check if file has tag
	 */
	hasTag: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[], ctx: FunctionContext): Value => {
			const tag = toString(args[0] ?? null).replace(/^#/, "");
			const metadata = ctx.getFileMetadata(ctx.filePath);
			if (!metadata) return false;
			return metadata.tags.some((t) => t === tag || t === "#" + tag);
		},
	},

	/**
	 * tags() - Get all tags from current file
	 */
	tags: {
		minArity: 0,
		maxArity: 0,
		call: (_args: Value[], ctx: FunctionContext): Value => {
			const metadata = ctx.getFileMetadata(ctx.filePath);
			if (!metadata) return [];
			return metadata.tags;
		},
	},

	/**
	 * hasLink(target) - Check if file has outgoing link to target
	 */
	hasLink: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[], ctx: FunctionContext): Value => {
			const target = toString(args[0] ?? null);
			const props = ctx.getProperties(ctx.filePath);
			const links = props["file.links"];
			if (!Array.isArray(links)) return false;
			return links.some((link) => {
				const linkStr = toString(link as Value);
				return linkStr === target || linkStr.endsWith("/" + target) || linkStr.endsWith(target + ".md");
			});
		},
	},

	/**
	 * backlinks() - Get all backlinks to current file
	 */
	backlinks: {
		minArity: 0,
		maxArity: 0,
		call: (_args: Value[], ctx: FunctionContext): Value => {
			const props = ctx.getProperties(ctx.filePath);
			const backlinks = props["file.backlinks"];
			return Array.isArray(backlinks) ? backlinks : [];
		},
	},

	/**
	 * outlinks() - Get all outgoing links from current file
	 */
	outlinks: {
		minArity: 0,
		maxArity: 0,
		call: (_args: Value[], ctx: FunctionContext): Value => {
			const props = ctx.getProperties(ctx.filePath);
			const links = props["file.links"];
			return Array.isArray(links) ? links : [];
		},
	},
};
