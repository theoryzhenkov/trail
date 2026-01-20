/**
 * Documentation extraction from node classes
 * 
 * Provides utilities to extract documentation and highlighting info
 * from the static properties on node classes.
 */

import type {NodeDoc} from "./types";
import {registry} from "./registry";
import {FunctionExprNode} from "./base/FunctionExprNode";
import {BUILTINS, getAllBuiltinProperties, getBuiltinDoc, type BuiltinProperty} from "./builtins";

// Import tokens to trigger registration
import "./tokens/keywords";

// Re-export for convenience
export {BUILTINS, getAllBuiltinProperties, getBuiltinDoc, type BuiltinProperty};

/**
 * Get documentation for any registered node by name
 * Works for functions, keywords, and other registered nodes
 */
export function getDoc(name: string): NodeDoc | undefined {
	// Try function first
	const funcDoc = getFunctionDoc(name);
	if (funcDoc) return funcDoc;
	
	// Try keyword
	return getKeywordDoc(name);
}

/**
 * Get documentation for a keyword
 */
export function getKeywordDoc(keyword: string): NodeDoc | undefined {
	const cls = registry.getTokenClass(keyword);
	return cls?.documentation;
}

/**
 * Get documentation for a function
 */
export function getFunctionDoc(name: string): NodeDoc | undefined {
	const cls = registry.getFunctionClass(name);
	if (!cls) return undefined;
	return (cls as unknown as typeof FunctionExprNode).documentation;
}

/**
 * Get highlighting category for a keyword
 */
export function getKeywordHighlighting(keyword: string): string | undefined {
	const cls = registry.getTokenClass(keyword);
	return cls?.highlighting;
}

/**
 * Get all keyword documentation as a record
 */
export function getAllKeywordDocs(): Record<string, NodeDoc> {
	const result: Record<string, NodeDoc> = {};
	for (const cls of registry.getAllTokenClasses()) {
		if (cls.keyword && cls.documentation) {
			result[cls.keyword.toLowerCase()] = cls.documentation;
		}
	}
	return result;
}

/**
 * Get all function documentation
 */
export function getAllFunctionDocs(): Map<string, NodeDoc> {
	const result = new Map<string, NodeDoc>();
	const classes = registry.getAllFunctionClasses();
	for (const [name, cls] of classes) {
		const doc = (cls as unknown as typeof FunctionExprNode).documentation;
		if (doc) {
			result.set(name, doc);
		}
	}
	return result;
}

/**
 * Check if a word is a keyword
 */
export function isKeyword(word: string): boolean {
	return registry.hasToken(word);
}

/**
 * Get all keywords
 */
export function getAllKeywords(): string[] {
	return registry.getAllTokenClasses()
		.map(cls => cls.keyword)
		.filter((k): k is string => k !== undefined);
}

/**
 * Get keywords by highlighting category
 */
export function getKeywordsByHighlighting(category: string): string[] {
	return registry.getAllTokenClasses()
		.filter(cls => cls.highlighting === category && cls.keyword)
		.map(cls => cls.keyword!);
}

/**
 * Clause keywords (for highlighting)
 */
export function getClauseKeywords(): string[] {
	return getKeywordsByHighlighting("keyword");
}

/**
 * Modifier keywords (for highlighting)
 */
export function getModifierKeywords(): string[] {
	return getKeywordsByHighlighting("typeName");
}

/**
 * Operator keywords (for highlighting)
 */
export function getOperatorKeywords(): string[] {
	return getKeywordsByHighlighting("operatorKeyword");
}

/**
 * Literal keywords (for highlighting)
 */
export function getLiteralKeywords(): string[] {
	return getKeywordsByHighlighting("atom");
}
