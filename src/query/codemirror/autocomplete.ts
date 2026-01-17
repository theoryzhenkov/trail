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
import {BUILTIN_FUNCTIONS, BuiltinFunction} from "../builtins";

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
const CLAUSE_COMPLETIONS: Completion[] = [
	{label: "group", type: "keyword", detail: "clause", info: "Define group name"},
	{label: "from", type: "keyword", detail: "clause", info: "Specify relations to traverse"},
	{label: "prune", type: "keyword", detail: "clause", info: "Stop traversal at matching nodes"},
	{label: "where", type: "keyword", detail: "clause", info: "Filter results"},
	{label: "when", type: "keyword", detail: "clause", info: "Conditional visibility"},
	{label: "sort", type: "keyword", detail: "clause", info: "Order results"},
	{label: "display", type: "keyword", detail: "clause", info: "Properties to show"},
];

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
 * Query context for determining completions
 */
type QueryContext = 
	| "start"
	| "afterGroup"
	| "afterFrom"
	| "afterRelation"
	| "afterDepth"
	| "expression"
	| "afterSort"
	| "afterSortBy"
	| "afterDisplay";

/**
 * Determine the current context from the document
 */
function getQueryContext(text: string, pos: number): QueryContext {
	const beforeCursor = text.slice(0, pos).toLowerCase();
	
	// Check what clause we're in based on keywords
	const lastClause = getLastClause(beforeCursor);
	
	if (!lastClause) {
		// Check if we have a group clause
		if (/group\s+"[^"]*"\s*$/.test(beforeCursor)) {
			return "afterGroup";
		}
		if (/group\s*$/.test(beforeCursor)) {
			return "start";
		}
		return "start";
	}
	
	switch (lastClause) {
		case "group":
			return "afterGroup";
		case "from":
			// Check if we're after a relation name
			if (/from\s+\w+\s*$/.test(beforeCursor) || 
			    /,\s*\w+\s*$/.test(beforeCursor.slice(beforeCursor.lastIndexOf("from")))) {
				return "afterRelation";
			}
			return "afterFrom";
		case "depth":
			return "afterDepth";
		case "where":
		case "when":
		case "prune":
			return "expression";
		case "sort":
			if (/sort\s+by\s*$/.test(beforeCursor)) {
				return "afterSortBy";
			}
			return "afterSort";
		case "display":
			return "afterDisplay";
		default:
			return "expression";
	}
}

function getLastClause(text: string): string | null {
	const clauses = ["group", "from", "depth", "prune", "where", "when", "sort", "display"];
	let lastClause: string | null = null;
	let lastPos = -1;
	
	for (const clause of clauses) {
		const pos = text.lastIndexOf(clause);
		if (pos > lastPos) {
			lastPos = pos;
			lastClause = clause;
		}
	}
	
	return lastClause;
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
				
				// Don't trigger in strings
				const line = context.state.doc.lineAt(context.pos);
				const beforeCursor = line.text.slice(0, context.pos - line.from);
				const quoteCount = (beforeCursor.match(/"/g) || []).length;
				if (quoteCount % 2 === 1) return null;
				
				const fullText = context.state.doc.toString();
				const queryContext = getQueryContext(fullText, context.pos);
				
				let completions: Completion[] = [];
				
				switch (queryContext) {
					case "start":
						completions = [{
							label: "group",
							type: "keyword",
							detail: "clause",
							info: "Start a new query",
							apply: snippet('group "${1:name}"\nfrom ${2:relation}'),
						}];
						break;
					
					case "afterGroup":
						completions = [
							{label: "from", type: "keyword", detail: "clause"},
						];
						break;
					
					case "afterFrom":
						// Relation names from settings
						completions = config.getRelationNames().map(name => ({
							label: name,
							type: "variable",
							detail: "relation",
						}));
						break;
					
					case "afterRelation":
						completions = [
							{label: "depth", type: "keyword", detail: "modifier"},
							{label: "extend", type: "keyword", detail: "modifier"},
							...CLAUSE_COMPLETIONS.filter(c => c.label !== "group" && c.label !== "from"),
						];
						break;
					
					case "afterDepth":
						completions = [
							{label: "unlimited", type: "keyword", detail: "value"},
							// Numbers are handled by the user typing them
						];
						break;
					
					case "expression":
						completions = [
							...functionCompletions,
							...propertyCompletions,
							...LOGICAL_COMPLETIONS,
							...LITERAL_COMPLETIONS,
							...DATE_COMPLETIONS,
						];
						break;
					
					case "afterSort":
						completions = [
							{label: "by", type: "keyword", detail: "modifier"},
						];
						break;
					
					case "afterSortBy":
						completions = [
							{label: "chain", type: "keyword", detail: "sort mode"},
							...propertyCompletions,
						];
						break;
					
					case "afterDisplay":
						completions = [
							{label: "all", type: "keyword", detail: "display"},
							...propertyCompletions,
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
