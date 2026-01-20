/**
 * TQL Language Definition for CodeMirror 6
 * 
 * Provides syntax highlighting for TQL queries using a stream parser.
 * 
 * NOTE: CM6's native highlighting (via tokenTable + HighlightStyle) does NOT work
 * in Obsidian plugins due to module instance fragmentation. The @lezer/highlight
 * module used by StreamLanguage to create NodeTypes with styleTags is a different
 * instance than the one used by TreeHighlighter to read those props.
 * 
 * Instead, we use a ViewPlugin that manually tokenizes and applies decorations,
 * bypassing CM6's native highlighting system entirely.
 */

import {
	StreamLanguage,
	StreamParser,
	StringStream,
	LanguageSupport,
} from "@codemirror/language";
import {Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate} from "@codemirror/view";
import {RangeSetBuilder} from "@codemirror/state";
import {
	getClauseKeywords,
	getModifierKeywords,
	getOperatorKeywords,
	getLiteralKeywords,
} from "../nodes/docs";

/**
 * TQL keywords categorized by type
 * Now sourced from node class static properties via the docs module.
 */
const CLAUSE_KEYWORDS = new Set(getClauseKeywords());

const MODIFIER_KEYWORDS = new Set(getModifierKeywords());

const LOGICAL_KEYWORDS = new Set(getOperatorKeywords());

const LITERAL_KEYWORDS = new Set(getLiteralKeywords());

const DATE_KEYWORDS = new Set([
	"today", "yesterday", "tomorrow", "startofweek", "endofweek"
]);

/**
 * Built-in function names for highlighting
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
 * TQL stream parser for CodeMirror.
 * Returns token type names that are mapped to Lezer tags via tokenTable.
 */
const tqlParserBase = {
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
		
		// Identifiers and keywords (support Unicode letters and symbols)
		// \p{L} = Letters, \p{So} = Other Symbols (includes №), \p{Sc} = Currency Symbols
		if (/[\p{L}\p{So}\p{Sc}_]/u.test(stream.peek() ?? "")) {
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

/**
 * Complete stream parser.
 * Note: tokenTable is not used since we use ViewPlugin-based highlighting.
 */
const tqlStreamParser: StreamParser<TQLState> = {
	...tqlParserBase,
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
	// Consume identifier (support Unicode letters, numbers, and symbols)
	// \p{L} = Letters, \p{N} = Numbers, \p{So} = Other Symbols, \p{Sc} = Currency Symbols
	stream.match(/^[\p{L}\p{So}\p{Sc}_][\p{L}\p{N}\p{So}\p{Sc}_-]*/u);
	const word = stream.current().toLowerCase();
	
	// Check for clause keywords (structural - use "keyword" → t.keyword)
	if (CLAUSE_KEYWORDS.has(word)) {
		state.context = word === "from" ? "afterFrom" : 
		               word === "sort" ? "afterSort" : "afterClause";
		return "keyword";
	}
	
	// Check for modifier keywords (secondary - maps to tags.typeName)
	if (MODIFIER_KEYWORDS.has(word)) {
		return "typeName";
	}
	
	// Check for logical keywords (maps to tags.operatorKeyword)
	if (LOGICAL_KEYWORDS.has(word)) {
		return "operatorKeyword";
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
	// Use "variableName.function" to get tags.function(tags.variableName)
	if (stream.peek() === "(") {
		return "variableName.function";
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
 * Create the TQL language.
 */
export const tqlLanguage = StreamLanguage.define(tqlStreamParser);

/**
 * Decoration marks for different token types.
 * These CSS classes are styled in styles.css.
 */
const keywordMark = Decoration.mark({class: "tql-keyword"});
const typeMark = Decoration.mark({class: "tql-type"});
const logicMark = Decoration.mark({class: "tql-logic"});
const stringMark = Decoration.mark({class: "tql-string"});
const numberMark = Decoration.mark({class: "tql-number"});
const atomMark = Decoration.mark({class: "tql-atom"});
const operatorMark = Decoration.mark({class: "tql-operator"});
const functionMark = Decoration.mark({class: "tql-function"});
const propertyMark = Decoration.mark({class: "tql-property"});
const variableMark = Decoration.mark({class: "tql-variable"});
const punctuationMark = Decoration.mark({class: "tql-punctuation"});

/**
 * Map token types to decoration marks
 */
const tokenToMark: {[key: string]: Decoration} = {
	keyword: keywordMark,
	typeName: typeMark,
	operatorKeyword: logicMark,
	string: stringMark,
	number: numberMark,
	atom: atomMark,
	operator: operatorMark,
	"variableName.function": functionMark,
	propertyName: propertyMark,
	variableName: variableMark,
	punctuation: punctuationMark,
};

/**
 * ViewPlugin that creates decorations by re-running the tokenizer.
 * This bypasses CM6's native highlighting which doesn't work in Obsidian plugins
 * due to @lezer/highlight module instance fragmentation.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	
	for (const {from, to} of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		let state = tqlParserBase.startState();
		
		// Simple stream implementation for tokenization
		let lineStart = 0;
		const lines = text.split("\n");
		
		for (const line of lines) {
			const stream = {
				string: line,
				pos: 0,
				start: 0,
				eol: () => stream.pos >= line.length,
				sol: () => stream.pos === 0,
				peek: () => line[stream.pos] ?? "",
				next: () => line[stream.pos++],
				eat: (match: string | RegExp) => {
					const ch = line[stream.pos] ?? "";
					if (typeof match === "string" ? ch === match : match.test(ch)) {
						stream.pos++;
						return ch;
					}
					return undefined;
				},
				eatWhile: (match: RegExp) => {
					const start = stream.pos;
					while (stream.pos < line.length && match.test(line[stream.pos] ?? "")) {
						stream.pos++;
					}
					return stream.pos > start;
				},
				eatSpace: () => {
					const start = stream.pos;
					while (stream.pos < line.length && /\s/.test(line[stream.pos] ?? "")) {
						stream.pos++;
					}
					return stream.pos > start;
				},
				match: (pattern: RegExp | string, consume = true) => {
					if (typeof pattern === "string") {
						if (line.slice(stream.pos).startsWith(pattern)) {
							if (consume) stream.pos += pattern.length;
							return true;
						}
						return false;
					}
					const match = line.slice(stream.pos).match(pattern);
					if (match && match.index === 0) {
						if (consume) stream.pos += match[0].length;
						return match;
					}
					return null;
				},
				current: () => line.slice(stream.start, stream.pos),
				skipToEnd: () => { stream.pos = line.length; },
			} as unknown as StringStream;
			
			while (!stream.eol()) {
				stream.start = stream.pos;
				const tokenType = tqlParserBase.token(stream, state);
				
				if (tokenType && tokenToMark[tokenType]) {
					const tokenStart = from + lineStart + stream.start;
					const tokenEnd = from + lineStart + stream.pos;
					builder.add(tokenStart, tokenEnd, tokenToMark[tokenType]);
				}
			}
			
			lineStart += line.length + 1; // +1 for newline
		}
	}
	
	return builder.finish();
}

/**
 * ViewPlugin for TQL syntax highlighting.
 * Manually applies decorations based on tokenization.
 */
export const tqlHighlightPlugin = ViewPlugin.fromClass(class {
	decorations: DecorationSet;
	
	constructor(view: EditorView) {
		this.decorations = buildDecorations(view);
	}
	
	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildDecorations(update.view);
		}
	}
}, {
	decorations: v => v.decorations
});

/**
 * TQL language support with ViewPlugin-based highlighting.
 * 
 * Uses manual decoration instead of CM6's native highlighting
 * because the native system doesn't work in Obsidian plugins.
 */
export function tql(): LanguageSupport {
	return new LanguageSupport(tqlLanguage, [tqlHighlightPlugin]);
}
