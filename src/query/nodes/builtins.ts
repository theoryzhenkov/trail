/**
 * Built-in Properties and Identifiers
 * 
 * Defines the built-in property namespaces ($file, $traversal) and their properties.
 */

import type {NodeDoc} from "./types";

/**
 * Built-in property definition
 */
export interface BuiltinProperty {
	name: string;
	type: string;
	description: string;
}

/**
 * Built-in identifier (namespace) definition
 */
export interface BuiltinIdentifier {
	name: string;
	description: string;
	properties: BuiltinProperty[];
}

/**
 * $file namespace - file metadata properties
 */
export const FILE_BUILTIN: BuiltinIdentifier = {
	name: "$file",
	description: "File metadata namespace",
	properties: [
		{name: "name", type: "string", description: "File name without extension"},
		{name: "path", type: "string", description: "Full file path"},
		{name: "folder", type: "string", description: "Parent folder path"},
		{name: "created", type: "date", description: "File creation date"},
		{name: "modified", type: "date", description: "Last modification date"},
		{name: "size", type: "number", description: "File size in bytes"},
		{name: "tags", type: "array", description: "File tags"},
	],
};

/**
 * $traversal namespace - traversal context properties
 */
export const TRAVERSAL_BUILTIN: BuiltinIdentifier = {
	name: "$traversal",
	description: "Traversal context namespace",
	properties: [
		{name: "depth", type: "number", description: "Depth from active file"},
		{name: "relation", type: "string", description: "Relation that led here"},
		{name: "isImplied", type: "boolean", description: "Whether edge is implied"},
		{name: "parent", type: "string", description: "Parent node path"},
		{name: "path", type: "array", description: "Full path from root"},
	],
};

/**
 * $chain - special sort identifier
 */
export const CHAIN_BUILTIN: BuiltinIdentifier = {
	name: "$chain",
	description: "Sort by sequence position in traversal chain",
	properties: [],
};

/**
 * All built-in identifiers
 */
export const BUILTINS: BuiltinIdentifier[] = [
	FILE_BUILTIN,
	TRAVERSAL_BUILTIN,
	CHAIN_BUILTIN,
];

/**
 * Get built-in identifier by name
 */
export function getBuiltin(name: string): BuiltinIdentifier | undefined {
	return BUILTINS.find(b => b.name === name);
}

/**
 * Get all built-in property paths (e.g., "file.name", "traversal.depth")
 */
export function getAllBuiltinProperties(): BuiltinProperty[] {
	const result: BuiltinProperty[] = [];
	for (const builtin of BUILTINS) {
		for (const prop of builtin.properties) {
			result.push({
				name: `${builtin.name.slice(1)}.${prop.name}`, // Remove $ prefix for property path
				type: prop.type,
				description: prop.description,
			});
		}
	}
	return result;
}

/**
 * Get documentation for a built-in identifier
 */
export function getBuiltinDoc(name: string): NodeDoc | undefined {
	const builtin = getBuiltin(name);
	if (!builtin) return undefined;
	
	return {
		title: builtin.name,
		description: builtin.description,
		syntax: builtin.properties.length > 0 
			? `${builtin.name}.property`
			: builtin.name,
		examples: builtin.properties.slice(0, 2).map(p => `${builtin.name}.${p.name}`),
	};
}
