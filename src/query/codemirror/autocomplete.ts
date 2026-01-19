/**
 * TQL Autocomplete Provider for CodeMirror 6
 * 
 * Provides context-aware completions for TQL queries.
 */

import {
	CompletionContext,
	CompletionResult,
	Completion,
	autocompletion,
	snippet,
} from "@codemirror/autocomplete";

/**
 * Function documentation for autocomplete
 */
export interface FunctionDoc {
	name: string;
	signature: string;
	description: string;
	returnType: string;
}

/**
 * Function documentation registry
 */
export const FUNCTION_DOCS: Record<string, FunctionDoc> = {
	// String functions
	contains: {
		name: "contains",
		signature: "contains(haystack, needle)",
		description: "Check if string contains substring",
		returnType: "boolean",
	},
	startsWith: {
		name: "startsWith",
		signature: "startsWith(string, prefix)",
		description: "Check if string starts with prefix",
		returnType: "boolean",
	},
	endsWith: {
		name: "endsWith",
		signature: "endsWith(string, suffix)",
		description: "Check if string ends with suffix",
		returnType: "boolean",
	},
	length: {
		name: "length",
		signature: "length(string)",
		description: "Get string length",
		returnType: "number",
	},
	lower: {
		name: "lower",
		signature: "lower(string)",
		description: "Convert string to lowercase",
		returnType: "string",
	},
	upper: {
		name: "upper",
		signature: "upper(string)",
		description: "Convert string to uppercase",
		returnType: "string",
	},
	trim: {
		name: "trim",
		signature: "trim(string)",
		description: "Remove leading and trailing whitespace",
		returnType: "string",
	},
	split: {
		name: "split",
		signature: "split(string, delimiter)",
		description: "Split string into array",
		returnType: "array",
	},
	matches: {
		name: "matches",
		signature: "matches(string, pattern)",
		description: "Test string against regex pattern",
		returnType: "boolean",
	},
	// File functions
	inFolder: {
		name: "inFolder",
		signature: "inFolder(folder)",
		description: "Check if file is in folder",
		returnType: "boolean",
	},
	hasExtension: {
		name: "hasExtension",
		signature: "hasExtension(ext)",
		description: "Check file extension",
		returnType: "boolean",
	},
	hasTag: {
		name: "hasTag",
		signature: "hasTag(tag)",
		description: "Check if file has tag",
		returnType: "boolean",
	},
	tags: {
		name: "tags",
		signature: "tags()",
		description: "Get all tags from file",
		returnType: "array",
	},
	hasLink: {
		name: "hasLink",
		signature: "hasLink(target)",
		description: "Check if file links to target",
		returnType: "boolean",
	},
	backlinks: {
		name: "backlinks",
		signature: "backlinks()",
		description: "Get files linking to this file",
		returnType: "array",
	},
	outlinks: {
		name: "outlinks",
		signature: "outlinks()",
		description: "Get files this file links to",
		returnType: "array",
	},
	// Array functions
	len: {
		name: "len",
		signature: "len(array)",
		description: "Get array length",
		returnType: "number",
	},
	first: {
		name: "first",
		signature: "first(array)",
		description: "Get first element",
		returnType: "any",
	},
	last: {
		name: "last",
		signature: "last(array)",
		description: "Get last element",
		returnType: "any",
	},
	isEmpty: {
		name: "isEmpty",
		signature: "isEmpty(array)",
		description: "Check if array is empty",
		returnType: "boolean",
	},
	// Existence functions
	exists: {
		name: "exists",
		signature: "exists(value)",
		description: "Check if value is not null",
		returnType: "boolean",
	},
	coalesce: {
		name: "coalesce",
		signature: "coalesce(value1, value2, ...)",
		description: "Return first non-null value",
		returnType: "any",
	},
	ifnull: {
		name: "ifnull",
		signature: "ifnull(value, default)",
		description: "Return default if value is null",
		returnType: "any",
	},
	// Date functions
	now: {
		name: "now",
		signature: "now()",
		description: "Get current date and time",
		returnType: "date",
	},
	date: {
		name: "date",
		signature: "date(string)",
		description: "Parse string to date",
		returnType: "date",
	},
	year: {
		name: "year",
		signature: "year(date)",
		description: "Get year from date",
		returnType: "number",
	},
	month: {
		name: "month",
		signature: "month(date)",
		description: "Get month from date (1-12)",
		returnType: "number",
	},
	day: {
		name: "day",
		signature: "day(date)",
		description: "Get day of month from date",
		returnType: "number",
	},
	weekday: {
		name: "weekday",
		signature: "weekday(date)",
		description: "Get day of week (0=Sun, 6=Sat)",
		returnType: "number",
	},
	hours: {
		name: "hours",
		signature: "hours(date)",
		description: "Get hours from date",
		returnType: "number",
	},
	minutes: {
		name: "minutes",
		signature: "minutes(date)",
		description: "Get minutes from date",
		returnType: "number",
	},
	format: {
		name: "format",
		signature: "format(date, pattern)",
		description: "Format date as string",
		returnType: "string",
	},
	dateDiff: {
		name: "dateDiff",
		signature: "dateDiff(date1, date2, unit)",
		description: "Get difference between dates",
		returnType: "number",
	},
	// Property access
	prop: {
		name: "prop",
		signature: "prop(name)",
		description: "Access property by name (for reserved names)",
		returnType: "any",
	},
};

/**
 * Property documentation
 */
export interface PropertyDoc {
	name: string;
	type: string;
	description: string;
}

/**
 * Built-in properties
 */
export const FILE_PROPERTIES: PropertyDoc[] = [
	{name: "file.name", type: "string", description: "File name without extension"},
	{name: "file.path", type: "string", description: "Full file path"},
	{name: "file.folder", type: "string", description: "Parent folder path"},
	{name: "file.created", type: "date", description: "File creation date"},
	{name: "file.modified", type: "date", description: "Last modification date"},
	{name: "file.size", type: "number", description: "File size in bytes"},
	{name: "file.tags", type: "array", description: "File tags"},
];

export const TRAVERSAL_PROPERTIES: PropertyDoc[] = [
	{name: "traversal.depth", type: "number", description: "Depth from active file"},
	{name: "traversal.relation", type: "string", description: "Relation that led here"},
	{name: "traversal.isImplied", type: "boolean", description: "Whether edge is implied"},
	{name: "traversal.parent", type: "string", description: "Parent node path"},
	{name: "traversal.path", type: "array", description: "Full path from root"},
];

/**
 * Keyword completions
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CLAUSE_COMPLETIONS: Completion[] = [
	{label: "group", type: "keyword", detail: "clause", info: "Define group name"},
	{label: "from", type: "keyword", detail: "clause", info: "Specify relations to traverse"},
	{label: "prune", type: "keyword", detail: "clause", info: "Stop traversal at matching nodes"},
	{label: "where", type: "keyword", detail: "clause", info: "Filter results"},
	{label: "when", type: "keyword", detail: "clause", info: "Conditional visibility"},
	{label: "sort", type: "keyword", detail: "clause", info: "Order results"},
	{label: "display", type: "keyword", detail: "clause", info: "Properties to show"},
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MODIFIER_COMPLETIONS: Completion[] = [
	{label: "depth", type: "keyword", detail: "modifier", info: "Set traversal depth"},
	{label: "unlimited", type: "keyword", detail: "value", info: "No depth limit"},
	{label: "extend", type: "keyword", detail: "modifier", info: "Extend with another group"},
	{label: "by", type: "keyword", detail: "modifier", info: "Sort by property"},
	{label: "asc", type: "keyword", detail: "direction", info: "Ascending order"},
	{label: "desc", type: "keyword", detail: "direction", info: "Descending order"},
	{label: "all", type: "keyword", detail: "display", info: "Show all properties"},
	{label: "chain", type: "keyword", detail: "sort", info: "Sort by sequence position"},
];

const LOGICAL_COMPLETIONS: Completion[] = [
	{label: "and", type: "keyword", detail: "operator", info: "Logical AND"},
	{label: "or", type: "keyword", detail: "operator", info: "Logical OR"},
	{label: "not", type: "keyword", detail: "operator", info: "Logical NOT"},
	{label: "in", type: "keyword", detail: "operator", info: "Membership check"},
];

const LITERAL_COMPLETIONS: Completion[] = [
	{label: "true", type: "constant", detail: "boolean"},
	{label: "false", type: "constant", detail: "boolean"},
	{label: "null", type: "constant", detail: "null"},
];

const DATE_COMPLETIONS: Completion[] = [
	{label: "today", type: "constant", detail: "date", info: "Current date"},
	{label: "yesterday", type: "constant", detail: "date", info: "Previous day"},
	{label: "tomorrow", type: "constant", detail: "date", info: "Next day"},
	{label: "startOfWeek", type: "constant", detail: "date", info: "Start of current week"},
	{label: "endOfWeek", type: "constant", detail: "date", info: "End of current week"},
];

/**
 * Create function completions from the registry
 */
function createFunctionCompletions(): Completion[] {
	return Object.entries(FUNCTION_DOCS).map(([name, doc]) => ({
		label: name,
		type: "function",
		detail: doc.signature,
		info: doc.description,
		apply: snippet(`${name}(\${1})`),
	}));
}

/**
 * Create property completions
 */
function createPropertyCompletions(): Completion[] {
	const completions: Completion[] = [];
	
	for (const prop of FILE_PROPERTIES) {
		completions.push({
			label: prop.name,
			type: "property",
			detail: prop.type,
			info: prop.description,
		});
	}
	
	for (const prop of TRAVERSAL_PROPERTIES) {
		completions.push({
			label: prop.name,
			type: "property",
			detail: prop.type,
			info: prop.description,
		});
	}
	
	return completions;
}

/**
 * Parsed query state for context-aware completions
 */
interface ParsedQueryState {
	hasGroup: boolean;
	groupComplete: boolean;
	hasFrom: boolean;
	fromComplete: boolean;
	hasPrune: boolean;
	pruneComplete: boolean;
	hasWhere: boolean;
	whereComplete: boolean;
	hasWhen: boolean;
	whenComplete: boolean;
	hasSort: boolean;
	sortComplete: boolean;
	hasDisplay: boolean;
	displayComplete: boolean;
	currentContext: QueryContext;
}

/**
 * Query context for determining completions
 */
type QueryContext = 
	| "start"
	| "awaitingGroupName"
	| "awaitingFrom"
	| "awaitingRelation"
	| "afterRelation"
	| "awaitingDepthValue"
	| "awaitingExtendValue"
	| "awaitingClause"
	| "expression"
	| "awaitingSortBy"
	| "awaitingSortKey"
	| "awaitingDisplayValue";

/**
 * Parse the query text up to cursor position to determine state
 */
function parseQueryState(text: string, pos: number): ParsedQueryState {
	const beforeCursor = text.slice(0, pos);
	const lowerText = beforeCursor.toLowerCase();
	
	const state: ParsedQueryState = {
		hasGroup: false,
		groupComplete: false,
		hasFrom: false,
		fromComplete: false,
		hasPrune: false,
		pruneComplete: false,
		hasWhere: false,
		whereComplete: false,
		hasWhen: false,
		whenComplete: false,
		hasSort: false,
		sortComplete: false,
		hasDisplay: false,
		displayComplete: false,
		currentContext: "start",
	};
	
	// Check for group clause
	const groupMatch = lowerText.match(/\bgroup\b/);
	if (groupMatch) {
		state.hasGroup = true;
		// Check if group name is complete (has closing quote)
		const afterGroup = beforeCursor.slice(groupMatch.index! + 5);
		const groupNameMatch = afterGroup.match(/^\s*"[^"]*"/);
		if (groupNameMatch) {
			state.groupComplete = true;
		}
	}
	
	// Check for from clause
	const fromMatch = lowerText.match(/\bfrom\b/);
	if (fromMatch) {
		state.hasFrom = true;
		// From is complete if we have at least one relation name
		const afterFrom = beforeCursor.slice(fromMatch.index! + 4);
		// Check if there's at least one relation name (identifier after from, supports Unicode letters/symbols)
		if (/^\s+[\p{L}\p{So}\p{Sc}_][\p{L}\p{N}\p{So}\p{Sc}_-]*/u.test(afterFrom)) {
			state.fromComplete = true;
		}
	}
	
	// Check for optional clauses - they're complete if followed by content or another clause
	const optionalClauses = [
		{keyword: "prune", hasKey: "hasPrune" as const, completeKey: "pruneComplete" as const},
		{keyword: "where", hasKey: "hasWhere" as const, completeKey: "whereComplete" as const},
		{keyword: "when", hasKey: "hasWhen" as const, completeKey: "whenComplete" as const},
	];
	
	for (const clause of optionalClauses) {
		const match = lowerText.match(new RegExp(`\\b${clause.keyword}\\b`));
		if (match) {
			state[clause.hasKey] = true;
			// Check if there's an expression after it
			const afterClause = beforeCursor.slice(match.index! + clause.keyword.length);
			// Has content if there's any non-whitespace that isn't another clause keyword
			if (/^\s+\S/.test(afterClause)) {
				state[clause.completeKey] = true;
			}
		}
	}
	
	// Check for sort clause
	const sortMatch = lowerText.match(/\bsort\b/);
	if (sortMatch) {
		state.hasSort = true;
		const afterSort = beforeCursor.slice(sortMatch.index! + 4);
		// Sort is complete if it has "by" followed by something
		if (/^\s+by\s+\S/.test(afterSort)) {
			state.sortComplete = true;
		}
	}
	
	// Check for display clause
	const displayMatch = lowerText.match(/\bdisplay\b/);
	if (displayMatch) {
		state.hasDisplay = true;
		const afterDisplay = beforeCursor.slice(displayMatch.index! + 7);
		// Display is complete if it has content
		if (/^\s+\S/.test(afterDisplay)) {
			state.displayComplete = true;
		}
	}
	
	// Determine current context based on what's at the end of the text
	state.currentContext = determineCurrentContext(beforeCursor, lowerText, state);
	
	return state;
}

/**
 * Determine the current editing context from the text before cursor
 */
function determineCurrentContext(
	text: string, 
	lowerText: string, 
	state: ParsedQueryState
): QueryContext {
	// Trim trailing whitespace for pattern matching, but note if there was whitespace
	const trimmedLower = lowerText.trimEnd();
	const hasTrailingWhitespace = lowerText.length > trimmedLower.length;
	
	// Check if we're in a string (odd number of quotes)
	const quoteCount = (text.match(/"/g) || []).length;
	if (quoteCount % 2 === 1) {
		// Inside a string - don't suggest
		return "start";
	}
	
	// Empty or just starting
	if (!trimmedLower || trimmedLower.length === 0) {
		return "start";
	}
	
	// Just typed "group" - awaiting group name
	if (/\bgroup\s*$/.test(lowerText)) {
		return "awaitingGroupName";
	}
	
	// Group complete but no from yet
	if (state.groupComplete && !state.hasFrom) {
		return "awaitingFrom";
	}
	
	// Just typed "from" - awaiting relation
	if (/\bfrom\s*$/.test(lowerText)) {
		return "awaitingRelation";
	}
	
	// Check if we're in the middle of the FROM clause
	// But only if no other clause has started after FROM
	if (state.hasFrom) {
		const fromIdx = lowerText.lastIndexOf("from");
		const afterFrom = lowerText.slice(fromIdx + 4);
		
		// Check if we've moved on to another clause - if so, skip FROM context
		const hasLaterClause = /\b(prune|where|when|sort|display)\b/.test(afterFrom);
		
		if (!hasLaterClause) {
			// After comma in from clause - awaiting another relation
			if (/,\s*$/.test(afterFrom)) {
				return "awaitingRelation";
			}
			
			// Just typed "depth" - awaiting value
			if (/\bdepth\s*$/.test(afterFrom)) {
				return "awaitingDepthValue";
			}
			
			// Just typed "extend" - awaiting group name
			if (/\bextend\s*$/.test(afterFrom)) {
				return "awaitingExtendValue";
			}
			
			// Check if depth is complete (has value after it)
			const depthComplete = /\bdepth\s+(?:\d+|unlimited)\b/.test(afterFrom);
			const extendComplete = /\bextend\s+(?:"[^"]*"|\w+)\b/.test(afterFrom);
			
			// After relation name (with possible complete modifiers)
			// If we have a relation name and we're after whitespace, suggest modifiers or clauses
			if (/\bfrom\s+[\p{L}\p{So}\p{Sc}_][\p{L}\p{N}\p{So}\p{Sc}_-]*/u.test(lowerText)) {
				// Check what's at the very end
				const lastToken = getLastToken(afterFrom);
				
				if (lastToken === "unlimited" || /^\d+$/.test(lastToken)) {
					// Just finished depth value - can add more modifiers or clauses
					if (hasTrailingWhitespace) {
						return "afterRelation";
					}
				}
				
				if (/[\p{L}\p{So}\p{Sc}_][\p{L}\p{N}\p{So}\p{Sc}_-]*\s*$/u.test(afterFrom) && !depthComplete && !extendComplete) {
					// Just after a relation name, suggest modifiers
					if (hasTrailingWhitespace) {
						return "afterRelation";
					}
				}
				
				// If we're typing (no trailing whitespace) and after from with relation
				if (!hasTrailingWhitespace && /[\p{L}\p{So}\p{Sc}]$/u.test(afterFrom)) {
					// Could be typing a modifier, relation, or clause
					return "afterRelation";
				}
				
				if (hasTrailingWhitespace) {
					return "afterRelation";
				}
			}
		}
	}
	
	// Check for expression clauses (prune, where, when)
	for (const clause of ["prune", "where", "when"]) {
		const clauseRegex = new RegExp(`\\b${clause}\\s*$`);
		if (clauseRegex.test(lowerText)) {
			return "expression";
		}
		// If we're in an expression clause and typing
		const clauseIdx = lowerText.lastIndexOf(clause);
		if (clauseIdx !== -1) {
			const afterClause = lowerText.slice(clauseIdx + clause.length);
			// Check if this clause is the "active" one (no other clause after it)
			const hasLaterClause = /\b(prune|where|when|sort|display)\b/.test(afterClause);
			if (!hasLaterClause && afterClause.trim().length > 0) {
				return "expression";
			}
		}
	}
	
	// Check for sort clause
	if (/\bsort\s*$/.test(lowerText)) {
		return "awaitingSortBy";
	}
	if (/\bsort\s+by\s*$/.test(lowerText)) {
		return "awaitingSortKey";
	}
	if (state.hasSort && !state.sortComplete) {
		const sortIdx = lowerText.lastIndexOf("sort");
		const afterSort = lowerText.slice(sortIdx + 4);
		if (/\s+by\s+/.test(afterSort)) {
			return "awaitingSortKey";
		}
		return "awaitingSortBy";
	}
	
	// Check for display clause
	if (/\bdisplay\s*$/.test(lowerText)) {
		return "awaitingDisplayValue";
	}
	if (state.hasDisplay && !state.displayComplete) {
		return "awaitingDisplayValue";
	}
	
	// Default: if we have from complete, we can add clauses
	if (state.fromComplete) {
		return "awaitingClause";
	}
	
	// Fallback
	if (!state.hasGroup) {
		return "start";
	}
	if (!state.groupComplete) {
		return "awaitingGroupName";
	}
	
	return "awaitingClause";
}

/**
 * Get the last word/token from text
 */
function getLastToken(text: string): string {
	const match = text.match(/([\p{L}\p{So}\p{Sc}_][\p{L}\p{N}\p{So}\p{Sc}_-]*|\d+)\s*$/u);
	return match?.[1] ?? "";
}

/**
 * Configuration for the autocomplete provider
 */
export interface TQLAutocompleteConfig {
	/** Available relation names from settings */
	getRelationNames: () => string[];
}

/**
 * Create TQL autocomplete provider
 */
export function createTQLAutocomplete(config: TQLAutocompleteConfig) {
	const functionCompletions = createFunctionCompletions();
	const propertyCompletions = createPropertyCompletions();
	
	return autocompletion({
		override: [
			(context: CompletionContext): CompletionResult | null => {
				const word = context.matchBefore(/[\w.]*$/);
				if (!word) return null;
				
				// Allow empty matches at start of line or after whitespace
				if (word.from === word.to && !context.explicit) {
					const charBefore = context.pos > 0 
						? context.state.doc.sliceString(context.pos - 1, context.pos) 
						: "\n";
					// Only trigger if after whitespace, newline, or at start
					if (!/[\s\n]/.test(charBefore) && context.pos > 0) {
						return null;
					}
				}
				
				// Don't trigger in strings
				const fullText = context.state.doc.toString();
				const textBeforeCursor = fullText.slice(0, context.pos);
				const quoteCount = (textBeforeCursor.match(/"/g) || []).length;
				if (quoteCount % 2 === 1) return null;
				
				// Parse the query state
				const state = parseQueryState(fullText, context.pos);
				
				let completions: Completion[] = [];
				
				switch (state.currentContext) {
					case "start":
						completions = [{
							label: "group",
							type: "keyword",
							detail: "clause",
							info: "Start a new query",
							apply: snippet('group "${1:name}"\nfrom ${2:relation}'),
						}];
						break;
					
					case "awaitingGroupName":
						// User needs to type a string - no completions
						completions = [];
						break;
					
					case "awaitingFrom":
						completions = [
							{label: "from", type: "keyword", detail: "clause", info: "Specify relations to traverse"},
						];
						break;
					
					case "awaitingRelation":
						// Relation names from settings
						completions = config.getRelationNames().map(name => ({
							label: name,
							type: "variable",
							detail: "relation",
						}));
						break;
					
					case "afterRelation":
						// After a relation name - can add modifiers, comma for more relations, or clauses
						// Also include expression completions since user might be starting an expression clause
						completions = [
							{label: "depth", type: "keyword", detail: "modifier", info: "Set traversal depth"},
							{label: "extend", type: "keyword", detail: "modifier", info: "Extend with another group"},
							// Allow adding more relations
							...config.getRelationNames().map(name => ({
								label: name,
								type: "variable",
								detail: "relation",
							})),
							// Suggest available clauses (not group or from)
							...getAvailableClauseCompletions(state),
							// Include expression completions (functions, properties, etc.)
							...functionCompletions,
							...propertyCompletions,
							...LOGICAL_COMPLETIONS,
							...LITERAL_COMPLETIONS,
							...DATE_COMPLETIONS,
						];
						break;
					
					case "awaitingDepthValue":
						completions = [
							{label: "unlimited", type: "keyword", detail: "value", info: "No depth limit"},
						];
						break;
					
					case "awaitingExtendValue":
						// Can be a group name (identifier or string)
						completions = [];
						break;
					
					case "awaitingClause":
						// Can add any unused optional clause
						// Also include expression completions since user might be starting an expression
						completions = [
							...getAvailableClauseCompletions(state),
							...functionCompletions,
							...propertyCompletions,
							...LOGICAL_COMPLETIONS,
							...LITERAL_COMPLETIONS,
							...DATE_COMPLETIONS,
						];
						break;
					
					case "expression":
						completions = [
							...functionCompletions,
							...propertyCompletions,
							...LOGICAL_COMPLETIONS,
							...LITERAL_COMPLETIONS,
							...DATE_COMPLETIONS,
							// Also allow transitioning to other clauses
							...getAvailableClauseCompletions(state),
						];
						break;
					
					case "awaitingSortBy":
						completions = [
							{label: "by", type: "keyword", detail: "modifier", info: "Sort by property"},
						];
						break;
					
					case "awaitingSortKey":
						completions = [
							{label: "chain", type: "keyword", detail: "sort mode", info: "Sort by sequence position"},
							{label: "asc", type: "keyword", detail: "direction", info: "Ascending order"},
							{label: "desc", type: "keyword", detail: "direction", info: "Descending order"},
							...propertyCompletions,
							// Allow transitioning to other clauses
							...getAvailableClauseCompletions(state),
						];
						break;
					
					case "awaitingDisplayValue":
						completions = [
							{label: "all", type: "keyword", detail: "display", info: "Show all properties"},
							...propertyCompletions,
							// Allow transitioning to other clauses
							...getAvailableClauseCompletions(state),
						];
						break;
				}
				
				// Filter by current word
				if (word.text) {
					const prefix = word.text.toLowerCase();
					completions = completions.filter(c => 
						c.label.toLowerCase().startsWith(prefix)
					);
				}
				
				if (completions.length === 0) return null;
				
				return {
					from: word.from,
					options: completions,
					validFor: /^[\w.]*$/,
				};
			}
		],
		defaultKeymap: true,
		maxRenderedOptions: 50,
		activateOnTyping: true,
	});
}

/**
 * Get available clause completions based on which clauses haven't been used yet
 */
function getAvailableClauseCompletions(state: ParsedQueryState): Completion[] {
	const completions: Completion[] = [];
	
	if (!state.hasPrune) {
		completions.push({
			label: "prune",
			type: "keyword",
			detail: "clause",
			info: "Stop traversal at matching nodes",
		});
	}
	
	if (!state.hasWhere) {
		completions.push({
			label: "where",
			type: "keyword",
			detail: "clause",
			info: "Filter results",
		});
	}
	
	if (!state.hasWhen) {
		completions.push({
			label: "when",
			type: "keyword",
			detail: "clause",
			info: "Conditional visibility",
		});
	}
	
	if (!state.hasSort) {
		completions.push({
			label: "sort",
			type: "keyword",
			detail: "clause",
			info: "Order results",
		});
	}
	
	if (!state.hasDisplay) {
		completions.push({
			label: "display",
			type: "keyword",
			detail: "clause",
			info: "Properties to show",
		});
	}
	
	return completions;
}
