/**
 * TQL Language Definition for CodeMirror 6
 * 
 * Provides syntax highlighting for TQL queries using a stream parser.
 */

import {
	StreamLanguage,
	StringStream,
	LanguageSupport,
} from "@codemirror/language";
import {Tag} from "@lezer/highlight";

// Custom tags for TQL-specific tokens
export const tqlTags = {
	clause: Tag.define(),
	relationName: Tag.define(),
	propertyPath: Tag.define(),
	duration: Tag.define(),
	dateKeyword: Tag.define(),
};

/**
 * TQL keywords categorized by type
 */
const CLAUSE_KEYWORDS = new Set([
	"group", "from", "prune", "where", "when", "sort", "display"
]);

const MODIFIER_KEYWORDS = new Set([
	"depth", "unlimited", "extend", "by", "asc", "desc", "all", "chain"
]);

const LOGICAL_KEYWORDS = new Set([
	"and", "or", "not", "in"
]);

const LITERAL_KEYWORDS = new Set([
	"true", "false", "null"
]);

const DATE_KEYWORDS = new Set([
	"today", "yesterday", "tomorrow", "startofweek", "endofweek"
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALL_KEYWORDS = new Set([
	...CLAUSE_KEYWORDS,
	...MODIFIER_KEYWORDS,
	...LOGICAL_KEYWORDS,
	...LITERAL_KEYWORDS,
	...DATE_KEYWORDS,
]);

/**
 * Built-in function names for highlighting
 */
const BUILTIN_FUNCTIONS = new Set([
	// String functions
	"contains", "startswith", "endswith", "length", "lower", "upper", "trim", "split", "matches",
	// File functions
	"infolder", "hasextension", "hastag", "tags", "haslink", "backlinks", "outlinks",
	// Array functions
	"len", "first", "last", "isempty",
	// Existence functions
	"exists", "coalesce", "ifnull",
	// Date functions
	"now", "date", "year", "month", "day", "weekday", "hours", "minutes", "format", "datediff",
	// Property access
	"prop",
]);

/**
 * Known property prefixes
 */
const PROPERTY_PREFIXES = new Set([
	"file", "traversal"
]);

/**
 * Stream parser state
 */
interface TQLState {
	inString: boolean;
	stringChar: string;
	context: "start" | "afterClause" | "expression" | "afterFrom" | "afterSort";
}

/**
 * TQL stream parser for CodeMirror
 */
const tqlParser = {
	name: "tql",
	
	startState(): TQLState {
		return {
			inString: false,
			stringChar: "",
			context: "start",
		};
	},
	
	token(stream: StringStream, state: TQLState): string | null {
		// Handle string continuation
		if (state.inString) {
			return tokenizeString(stream, state);
		}
		
		// Skip whitespace
		if (stream.eatSpace()) {
			return null;
		}
		
		// String start
		if (stream.peek() === '"') {
			state.inString = true;
			state.stringChar = '"';
			stream.next();
			return tokenizeString(stream, state);
		}
		
		// Numbers and durations
		if (/[0-9]/.test(stream.peek() ?? "")) {
			return tokenizeNumber(stream);
		}
		
		// Date literals (YYYY-MM-DD)
		if (stream.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/, false)) {
			stream.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/);
			return "number";
		}
		
		// Operators
		if (stream.match("!=?") || stream.match("=?")) {
			return "operator";
		}
		if (stream.match("!=") || stream.match("<=") || stream.match(">=") || stream.match("..")) {
			return "operator";
		}
		if (/[=<>!+-]/.test(stream.peek() ?? "")) {
			stream.next();
			return "operator";
		}
		
		// Delimiters
		if (/[(),.]/.test(stream.peek() ?? "")) {
			stream.next();
			return "punctuation";
		}
		
		// Identifiers and keywords
		if (/[a-zA-Z_]/.test(stream.peek() ?? "")) {
			return tokenizeIdentifier(stream, state);
		}
		
		// Unknown character
		stream.next();
		return null;
	},
	
	copyState(state: TQLState): TQLState {
		return {...state};
	},
};

function tokenizeString(stream: StringStream, state: TQLState): string {
	let escaped = false;
	
	while (!stream.eol()) {
		const char = stream.next();
		
		if (escaped) {
			escaped = false;
			continue;
		}
		
		if (char === "\\") {
			escaped = true;
			continue;
		}
		
		if (char === state.stringChar) {
			state.inString = false;
			break;
		}
	}
	
	return "string";
}

function tokenizeNumber(stream: StringStream): string {
	// Consume digits
	stream.match(/^\d+/);
	
	// Check for decimal
	if (stream.peek() === "." && /\d/.test(stream.peek() ?? "")) {
		stream.next();
		stream.match(/^\d+/);
	}
	
	// Check for duration suffix
	if (/[dwmy]/.test(stream.peek() ?? "")) {
		stream.next();
		return "number"; // Duration
	}
	
	return "number";
}

function tokenizeIdentifier(stream: StringStream, state: TQLState): string {
	// Consume identifier
	stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/);
	const word = stream.current().toLowerCase();
	
	// Check for clause keywords
	if (CLAUSE_KEYWORDS.has(word)) {
		state.context = word === "from" ? "afterFrom" : 
		               word === "sort" ? "afterSort" : "afterClause";
		return "keyword";
	}
	
	// Check for modifier keywords
	if (MODIFIER_KEYWORDS.has(word)) {
		return "keyword";
	}
	
	// Check for logical keywords
	if (LOGICAL_KEYWORDS.has(word)) {
		return "keyword";
	}
	
	// Check for literal keywords
	if (LITERAL_KEYWORDS.has(word)) {
		return "atom";
	}
	
	// Check for date keywords
	if (DATE_KEYWORDS.has(word)) {
		return "atom";
	}
	
	// Check if it's a function call (followed by parenthesis)
	if (stream.peek() === "(") {
		if (BUILTIN_FUNCTIONS.has(word)) {
			return "function";
		}
		return "function";
	}
	
	// Check for property prefixes (file., traversal.)
	if (PROPERTY_PREFIXES.has(word)) {
		return "propertyName";
	}
	
	// Context-based classification
	if (state.context === "afterFrom") {
		// After FROM, identifiers are relation names
		return "variableName";
	}
	
	// Default: variable/property name
	return "variableName";
}

/**
 * Create the TQL language support
 */
export const tqlLanguage = StreamLanguage.define(tqlParser);

/**
 * TQL language support with highlighting
 */
export function tql(): LanguageSupport {
	return new LanguageSupport(tqlLanguage);
}
