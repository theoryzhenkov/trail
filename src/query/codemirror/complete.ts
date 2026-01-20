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
import type {SyntaxNode, Tree} from "@lezer/common";
import {registry} from "../nodes/registry";
import type {CompletionContext as TQLCompletionContext} from "../nodes/types";
import {getAllFunctionDocs, getAllBuiltinProperties, getBuiltins} from "../nodes/docs";

// Import tokens and functions to trigger registration
import "../nodes/tokens/keywords";
import "../nodes/functions";
// Import clauses to trigger registration
import "../nodes/clauses";

/**
 * Determine completion contexts by walking up the tree from cursor position
 */
function determineCompletionContexts(tree: Tree, pos: number): Set<TQLCompletionContext> {
	let node: SyntaxNode | null = tree.resolveInner(pos, -1);
	
	// Skip error nodes
	while (node && node.name === "⚠") {
		node = node.parent;
	}
	
	const contexts = new Set<TQLCompletionContext>();
	
	// Walk up to find INNERMOST context provider
	while (node && node.name !== "Query") {
		const providedContexts = registry.getProvidedContexts(node.name);
		if (providedContexts?.length) {
			for (const ctx of providedContexts) contexts.add(ctx);
			break; // Innermost provider wins - stop here
		}
		node = node.parent;
	}
	
	// Always add "clause" when inside any clause (or at top level)
	contexts.add("clause");
	
	return contexts;
}

/**
 * Configuration for the autocomplete provider
 */
export interface TQLAutocompleteConfig {
	/** Available relation names from settings */
	getRelationNames: () => string[];
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
 * Build completions for a specific context
 */
function buildCompletionsForContext(
	context: TQLCompletionContext,
	config: TQLAutocompleteConfig,
	usedClauses: Set<string>
): Completion[] {
	const completions: Completion[] = [];
	
	// Get registered completables for this context
	const completables = registry.getCompletablesForContext(context);
	const seen = new Set<string>();
	
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
	
	// Add dynamic completions based on context
	if (context === "relation") {
		const relationCompletions = createRelationCompletions(config.getRelationNames);
		completions.push(...relationCompletions);
	}
	
	if (context === "expression" || context === "after-expression") {
		// Add function completions
		const docs = getAllFunctionDocs();
		for (const [name, doc] of docs) {
			completions.push({
				label: name,
				type: "function",
				detail: doc.syntax ?? `${name}()`,
				info: doc.description,
				apply: snippet(`${name}(\${1})`),
			});
		}
		
		// Add builtin identifier completions
		const builtins = getBuiltins();
		for (const builtin of builtins) {
			completions.push({
				label: builtin.name,
				type: "variable",
				detail: "built-in",
				info: builtin.description,
			});
		}
		
		// Add property completions
		const properties = getAllBuiltinProperties();
		for (const prop of properties) {
			completions.push({
				label: prop.name,
				type: "property",
				detail: prop.type,
				info: prop.description,
			});
		}
	}
	
	if (context === "sort-key") {
		// Add builtin identifier completions
		const builtins = getBuiltins();
		for (const builtin of builtins) {
			completions.push({
				label: builtin.name,
				type: "variable",
				detail: "built-in",
				info: builtin.description,
			});
		}
		
		// Add property completions
		const properties = getAllBuiltinProperties();
		for (const prop of properties) {
			completions.push({
				label: prop.name,
				type: "property",
				detail: prop.type,
				info: prop.description,
			});
		}
	}
	
	if (context === "display") {
		// Add builtin identifier completions
		const builtins = getBuiltins();
		for (const builtin of builtins) {
			completions.push({
				label: builtin.name,
				type: "variable",
				detail: "built-in",
				info: builtin.description,
			});
		}
		
		// Add property completions
		const properties = getAllBuiltinProperties();
		for (const prop of properties) {
			completions.push({
				label: prop.name,
				type: "property",
				detail: prop.type,
				info: prop.description,
			});
		}
	}
	
	// Filter clause completions if in clause context
	if (context === "clause") {
		const allClauses: Array<{name: string; info: string}> = [
			{name: "prune", info: "Stop traversal at matching nodes"},
			{name: "where", info: "Filter results"},
			{name: "when", info: "Conditional visibility"},
			{name: "sort", info: "Order results"},
			{name: "display", info: "Properties to show"},
		];
		
		for (const clause of allClauses) {
			if (!usedClauses.has(clause.name)) {
				completions.push({
					label: clause.name,
					type: "keyword",
					detail: "clause",
					info: clause.info,
				});
			}
		}
	}
	
	return completions;
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
				
				// Get the syntax tree
				const tree = syntaxTree(context.state);
				
				// Determine completion contexts by walking up the tree
				const contexts = determineCompletionContexts(tree, context.pos);
				
				// Find which clauses are already used
				const usedClauses = findUsedClauses(tree.topNode);
				
				// Build completions for each context
				let completions: Completion[] = [];
				for (const ctx of contexts) {
					completions.push(...buildCompletionsForContext(ctx, config, usedClauses));
				}
				
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
