/**
 * TQL Syntax Highlighting Props for Lezer Grammar
 * 
 * Defines highlighting styles for each grammar node type.
 * 
 * NOTE: CM6's native highlighting (via styleTags + HighlightStyle) does NOT work
 * in Obsidian plugins due to module instance fragmentation. However, we still
 * define these props for:
 * 1. Semantic information about node types
 * 2. Potential future use if Obsidian fixes the fragmentation issue
 * 3. Non-Obsidian use cases
 * 
 * Actual highlighting is done via ViewPlugin decorations in language.ts
 */

import {styleTags, tags as t} from "@lezer/highlight";

/**
 * Highlighting props for TQL grammar nodes.
 * Maps node names to Lezer highlight tags.
 * 
 * Note: Operators like =, !=, etc. are not styled here because they're
 * inline tokens in the grammar. ViewPlugin-based highlighting in language.ts
 * handles operator styling.
 */
export const highlighting = styleTags({
	// Keywords - clause starters (structural)
	"group from prune where when sort display": t.keyword,
	
	// Keywords - modifiers (secondary keywords)
	"depth extend flatten asc desc all": t.typeName,
	
	// Logical operators (keywords)
	"and or not in": t.operatorKeyword,
	
	// Literals
	String: t.string,
	Number: t.number,
	Duration: t.number,
	Boolean: t.bool,
	Null: t.null,
	DateLiteral: t.number,
	"today yesterday tomorrow startOfWeek endOfWeek": t.atom,
	
	// Identifiers
	Identifier: t.variableName,
	BuiltinIdentifier: t.special(t.variableName),
	PropertyAccess: t.propertyName,
	RelationSpec: t.variableName,
	
	// Functions
	"FunctionCall/Identifier": t.function(t.variableName),
	
	// Inline query
	"@": t.keyword,
	
	// Comments
	LineComment: t.lineComment,
});
