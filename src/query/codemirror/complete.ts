/**
 * AST-based TQL Autocomplete Provider
 * 
 * Uses the Lezer syntax tree to provide context-aware completions.
 * Each node type can define its own completions.
 */

import {
	CompletionContext,
	CompletionResult,
	Completion,
	autocompletion,
	snippet,
} from "@codemirror/autocomplete";
import {syntaxTree} from "@codemirror/language";
import type {SyntaxNode} from "@lezer/common";
import {registry} from "../nodes/registry";
import type {CompletionContext as TQLCompletionContext} from "../nodes/types";
import {getAllFunctionDocs, getAllBuiltinProperties, getBuiltins} from "../nodes/docs";

// Import tokens and functions to trigger registration
import "../nodes/tokens/keywords";
import "../nodes/functions";
// Import clauses to trigger registration
import "../nodes/clauses";

/**
 * Get expression clause Lezer names from registry (lazy initialization)
 */
function getExpressionClauses(): Set<string> {
	return registry.getExpressionClauseLezerNames();
}

/**
 * Get expression node Lezer names from registry (lazy initialization)
 */
function getExpressionNodes(): Set<string> {
	return registry.getExpressionNodeLezerNames();
}

/**
 * Configuration for the autocomplete provider
 */
export interface TQLAutocompleteConfig {
	/** Available relation names from settings */
	getRelationNames: () => string[];
}

/**
 * Get completions from registry for given contexts
 */
function getRegistryCompletions(contexts: TQLCompletionContext[]): Completion[] {
	const completions: Completion[] = [];
	const seen = new Set<string>();

	for (const ctx of contexts) {
		const completables = registry.getCompletablesForContext(ctx);
		for (const cls of completables) {
			const completable = cls.completable;
			if (!completable) continue;
			
			const keyword = completable.keywords?.[0];
			if (!keyword || seen.has(keyword)) continue;
			
			seen.add(keyword);
			const doc = cls.documentation;
			
			const typeMap: Record<string, string> = {
				keyword: "keyword",
				operator: "keyword",
				function: "function",
				property: "property",
				value: "constant",
			};
			
			const completion: Completion = {
				label: keyword,
				type: typeMap[completable.category ?? "keyword"] ?? "keyword",
				detail: completable.category ?? "keyword",
				info: doc?.description,
			};

			if (completable.snippet) {
				completion.apply = snippet(completable.snippet);
			}

			completions.push(completion);
		}
	}

	return completions;
}

/**
 * Create function completions from registered functions
 */
function createFunctionCompletions(): Completion[] {
	const docs = getAllFunctionDocs();
	const completions: Completion[] = [];
	
	for (const [name, doc] of docs) {
		completions.push({
			label: name,
			type: "function",
			detail: doc.syntax ?? `${name}()`,
			info: doc.description,
			apply: snippet(`${name}(\${1})`),
		});
	}
	
	return completions;
}

/**
 * Create built-in identifier completions from registered builtins
 */
function createBuiltinIdentifierCompletions(): Completion[] {
	return getBuiltins().map(builtin => ({
		label: builtin.name,
		type: "variable",
		detail: "built-in",
		info: builtin.description,
	}));
}

/**
 * Create property completions from registered builtins
 */
function createPropertyCompletions(): Completion[] {
	return getAllBuiltinProperties().map(prop => ({
		label: prop.name,
		type: "property",
		detail: prop.type,
		info: prop.description,
	}));
}

/**
 * Create relation name completions
 */
function createRelationCompletions(getRelationNames: () => string[]): Completion[] {
	return getRelationNames().map(name => ({
		label: name,
		type: "variable",
		detail: "relation",
	}));
}

/**
 * Create clause completions for clauses that haven't been used
 */
function createClauseCompletions(usedClauses: Set<string>): Completion[] {
	const allClauses: Array<{name: string; info: string}> = [
		{name: "prune", info: "Stop traversal at matching nodes"},
		{name: "where", info: "Filter results"},
		{name: "when", info: "Conditional visibility"},
		{name: "sort", info: "Order results"},
		{name: "display", info: "Properties to show"},
	];
	
	return allClauses
		.filter(c => !usedClauses.has(c.name))
		.map(c => ({
			label: c.name,
			type: "keyword",
			detail: "clause",
			info: c.info,
		}));
}

/**
 * Find which clauses are already present in the query
 */
function findUsedClauses(tree: SyntaxNode): Set<string> {
	const used = new Set<string>();
	
	// Walk the tree to find clause nodes
	let cursor = tree.cursor();
	do {
		const name = cursor.name.toLowerCase();
		if (["prune", "where", "when", "sort", "display"].includes(name)) {
			used.add(name);
		}
	} while (cursor.next());
	
	return used;
}

/**
 * Determine completions based on the node at cursor position
 */
function getCompletionsForNode(
	node: SyntaxNode,
	config: TQLAutocompleteConfig,
	usedClauses: Set<string>,
): Completion[] {
	const name = node.name;
	const parentName = node.parent?.name ?? "";
	
	// Cache commonly used completions
	const functionCompletions = createFunctionCompletions();
	const builtinCompletions = createBuiltinIdentifierCompletions();
	const propertyCompletions = createPropertyCompletions();
	const relationCompletions = createRelationCompletions(config.getRelationNames);
	const clauseCompletions = createClauseCompletions(usedClauses);
	
	// Expression completions (functions, builtins, properties, operators)
	const expressionCompletions = [
		...functionCompletions,
		...builtinCompletions,
		...propertyCompletions,
		...getRegistryCompletions(["expression", "after-expression"]),
	];
	
	// At the top level Query node or Error node - check what's present
	if (name === "Query" || name === "⚠") {
		// Walk to see what we have
		const root = node.name === "Query" ? node : node.parent;
		if (!root) {
			return [{
				label: "group",
				type: "keyword",
				detail: "clause",
				info: "Start a new query",
				apply: snippet('group "${1:name}"\nfrom ${2:relation}'),
			}];
		}
		
		const hasGroup = root.getChild("Group") !== null;
		const hasFrom = root.getChild("From") !== null;
		
		if (!hasGroup) {
			return [{
				label: "group",
				type: "keyword",
				detail: "clause",
				info: "Start a new query",
				apply: snippet('group "${1:name}"\nfrom ${2:relation}'),
			}];
		}
		
		if (!hasFrom) {
			return [{
				label: "from",
				type: "keyword",
				detail: "clause",
				info: "Specify relations to traverse",
			}];
		}
		
		// Has both - can add clauses or might be in expression context
		return [...clauseCompletions, ...expressionCompletions];
	}
	
	// Inside Group clause - user needs to type a string, no completions
	if (name === "Group" || parentName === "Group") {
		return [];
	}
	
	// Inside From clause
	if (name === "From" || parentName === "From") {
		return [
			...relationCompletions,
			...getRegistryCompletions(["after-relation"]),
			...clauseCompletions,
		];
	}
	
	// Inside RelationSpec
	if (name === "RelationSpec" || parentName === "RelationSpec") {
		return [
			...getRegistryCompletions(["after-relation"]),
			...relationCompletions,
			...clauseCompletions,
		];
	}
	
	// Depth modifier - expecting number or "unlimited"
	if (name === "Depth" || parentName === "Depth") {
		return [{
			label: "unlimited",
			type: "keyword",
			detail: "value",
			info: "No depth limit",
		}];
	}
	
	// Expression clauses (prune, where, when)
	const expressionClauses = getExpressionClauses();
	if (expressionClauses.has(name) || expressionClauses.has(parentName)) {
		return [...expressionCompletions, ...clauseCompletions];
	}
	
	// Inside any expression node
	const expressionNodes = getExpressionNodes();
	if (expressionNodes.has(name) || expressionNodes.has(parentName)) {
		return [...expressionCompletions, ...clauseCompletions];
	}
	
	// Sort clause
	if (name === "Sort" || parentName === "Sort" || name === "SortKey" || parentName === "SortKey") {
		return [
			...builtinCompletions,
			...propertyCompletions,
			...getRegistryCompletions(["sort-key"]),
			...clauseCompletions,
		];
	}
	
	// Display clause
	if (name === "Display" || parentName === "Display" || name === "DisplayList" || parentName === "DisplayList") {
		return [
			...getRegistryCompletions(["display"]),
			...builtinCompletions,
			...propertyCompletions,
			...clauseCompletions,
		];
	}
	
	// Identifier - context-dependent
	if (name === "Identifier") {
		// Check grandparent for context
		const grandparent = node.parent?.parent;
		if (grandparent) {
			if (grandparent.name === "From" || grandparent.name === "RelationSpec") {
				return [...relationCompletions, ...getRegistryCompletions(["after-relation"])];
			}
			const expressionClauses = getExpressionClauses();
			const expressionNodes = getExpressionNodes();
			if (expressionClauses.has(grandparent.name) || expressionNodes.has(grandparent.name)) {
				return expressionCompletions;
			}
		}
		// Default: expression context
		return expressionCompletions;
	}
	
	// Default: suggest everything applicable
	return [...clauseCompletions, ...expressionCompletions];
}

/**
 * Create AST-based TQL autocomplete provider
 */
export function createTQLAutocomplete(config: TQLAutocompleteConfig) {
	return autocompletion({
		override: [
			(context: CompletionContext): CompletionResult | null => {
				// Match word at cursor
				const word = context.matchBefore(/[\w.$]*$/);
				if (!word) return null;
				
				// Allow empty matches at start of line or after whitespace
				if (word.from === word.to && !context.explicit) {
					const charBefore = context.pos > 0 
						? context.state.doc.sliceString(context.pos - 1, context.pos) 
						: "\n";
					if (!/[\s\n]/.test(charBefore) && context.pos > 0) {
						return null;
					}
				}
				
				// Don't trigger in strings
				const fullText = context.state.doc.toString();
				const textBeforeCursor = fullText.slice(0, context.pos);
				const quoteCount = (textBeforeCursor.match(/"/g) || []).length;
				if (quoteCount % 2 === 1) return null;
				
				// Get the syntax tree and find node at cursor
				const tree = syntaxTree(context.state);
				const node = tree.resolveInner(context.pos, -1);
				
				// Find which clauses are already used
				const usedClauses = findUsedClauses(tree.topNode);
				
				// Get completions for this node
				let completions = getCompletionsForNode(node, config, usedClauses);
				
				// Filter by current word
				if (word.text) {
					const prefix = word.text.toLowerCase();
					completions = completions.filter(c => 
						c.label.toLowerCase().startsWith(prefix)
					);
				}
				
				// Remove duplicates
				const seen = new Set<string>();
				completions = completions.filter(c => {
					if (seen.has(c.label)) return false;
					seen.add(c.label);
					return true;
				});
				
				if (completions.length === 0) return null;
				
				return {
					from: word.from,
					options: completions,
					validFor: /^[\w.$]*$/,
				};
			}
		],
		defaultKeymap: true,
		maxRenderedOptions: 50,
		activateOnTyping: true,
	});
}
