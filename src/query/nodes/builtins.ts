/**
 * Built-in Properties and Identifiers
 * 
 * Defines the built-in property namespaces ($file, $traversal) and their properties.
 */

import type {NodeDoc} from "./types";
import {BuiltinNode, type BuiltinProperty} from "./base/BuiltinNode";
import {getAllBuiltinClasses, getBuiltinClass, register} from "./registry";

/**
 * Built-in identifier (namespace) definition (for backwards compatibility)
 */
export interface BuiltinIdentifier {
	name: string;
	description: string;
	properties: BuiltinProperty[];
}

/**
 * $file namespace - file metadata properties
 */
@register("FileBuiltin", {builtin: "$file"})
export class FileBuiltin extends BuiltinNode {
	static properties: BuiltinProperty[] = [
		{name: "name", type: "string", description: "File name without extension"},
		{name: "path", type: "string", description: "Full file path"},
		{name: "folder", type: "string", description: "Parent folder path"},
		{name: "created", type: "date", description: "File creation date"},
		{name: "modified", type: "date", description: "Last modification date"},
		{name: "size", type: "number", description: "File size in bytes"},
		{name: "tags", type: "array", description: "File tags"},
	];

	static documentation: NodeDoc = {
		title: "$file",
		description: "File metadata namespace",
		syntax: "$file.property",
		examples: ["$file.name", "$file.modified", "$file.tags"],
	};
}

/**
 * $traversal namespace - traversal context properties
 */
@register("TraversalBuiltin", {builtin: "$traversal"})
export class TraversalBuiltin extends BuiltinNode {
	static properties: BuiltinProperty[] = [
		{name: "depth", type: "number", description: "Depth from active file"},
		{name: "relation", type: "string", description: "Relation that led here"},
		{name: "isImplied", type: "boolean", description: "Whether edge is implied"},
		{name: "parent", type: "string", description: "Parent node path"},
		{name: "path", type: "array", description: "Full path from root"},
	];

	static documentation: NodeDoc = {
		title: "$traversal",
		description: "Traversal context namespace",
		syntax: "$traversal.property",
		examples: ["$traversal.depth", "$traversal.relation"],
	};
}

/**
 * $chain - special sort identifier
 */
@register("ChainBuiltin", {builtin: "$chain"})
export class ChainBuiltin extends BuiltinNode {
	static properties: BuiltinProperty[] = [];

	static documentation: NodeDoc = {
		title: "$chain",
		description: "Sort by sequence position in traversal chain",
		syntax: "$chain",
		examples: ["$chain"],
	};
}

/**
 * Get built-in identifier by name
 */
export function getBuiltin(name: string): BuiltinIdentifier | undefined {
	return getBuiltins().find(b => b.name === name);
}

/**
 * Get all built-in property paths (e.g., "file.name", "traversal.depth")
 */
export function getAllBuiltinProperties(): BuiltinProperty[] {
	const result: BuiltinProperty[] = [];
	for (const builtin of getBuiltins()) {
		for (const prop of builtin.properties) {
			result.push({
				name: `${builtin.name}.${prop.name}`, // Keep $ prefix for builtin properties
				type: prop.type,
				description: prop.description,
			});
		}
	}
	return result;
}

export function getBuiltins(): BuiltinIdentifier[] {
	const result: BuiltinIdentifier[] = [];
	for (const [name, cls] of getAllBuiltinClasses()) {
		const properties = cls.properties ?? [];
		const description = cls.documentation?.description ?? "Built-in identifier";
		result.push({
			name,
			description,
			properties,
		});
	}
	return result;
}

/**
 * Get documentation for a built-in identifier
 */
export function getBuiltinDoc(name: string): NodeDoc | undefined {
	const cls = getBuiltinClass(name);
	if (!cls) return undefined;
	
	if (cls.documentation) {
		return cls.documentation;
	}
	
	// Fallback to generating from data
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

// Re-export BuiltinProperty for backwards compatibility
export type {BuiltinProperty} from "./base/BuiltinNode";
