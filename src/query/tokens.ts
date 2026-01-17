/**
 * TQL Token Types and Token Interface
 */

export enum TokenType {
	// Literals
	String = "String",
	Number = "Number",
	Boolean = "Boolean",
	Null = "Null",
	DateLiteral = "DateLiteral", // ISO date: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS

	// Identifiers
	Identifier = "Identifier",

	// Keywords
	Group = "Group",
	From = "From",
	Depth = "Depth",
	Unlimited = "Unlimited",
	Extend = "Extend",
	Prune = "Prune",
	Where = "Where",
	When = "When",
	Sort = "Sort",
	By = "By",
	Chain = "Chain",
	Asc = "Asc",
	Desc = "Desc",
	Display = "Display",
	All = "All",
	And = "And",
	Or = "Or",
	Not = "Not",
	In = "In",
	True = "True",
	False = "False",

	// Date keywords
	Today = "Today",
	Yesterday = "Yesterday",
	Tomorrow = "Tomorrow",
	StartOfWeek = "StartOfWeek",
	EndOfWeek = "EndOfWeek",

	// Operators
	Eq = "Eq",               // =
	NotEq = "NotEq",         // !=
	Lt = "Lt",               // <
	Gt = "Gt",               // >
	LtEq = "LtEq",           // <=
	GtEq = "GtEq",           // >=
	EqNull = "EqNull",       // =?
	NotEqNull = "NotEqNull", // !=?
	Plus = "Plus",           // +
	Minus = "Minus",         // -
	Bang = "Bang",           // !

	// Delimiters
	LParen = "LParen",       // (
	RParen = "RParen",       // )
	Comma = "Comma",         // ,
	Dot = "Dot",             // .
	DotDot = "DotDot",       // ..

	// Duration units
	Duration = "Duration",   // e.g., 7d, 1w, 2m, 1y

	// Special
	EOF = "EOF",
}

export interface Span {
	start: number;
	end: number;
}

export interface Token {
	type: TokenType;
	value: string;
	span: Span;
}

/**
 * Keywords map for lexer lookup
 */
export const KEYWORDS: Record<string, TokenType> = {
	group: TokenType.Group,
	from: TokenType.From,
	depth: TokenType.Depth,
	unlimited: TokenType.Unlimited,
	extend: TokenType.Extend,
	prune: TokenType.Prune,
	where: TokenType.Where,
	when: TokenType.When,
	sort: TokenType.Sort,
	by: TokenType.By,
	chain: TokenType.Chain,
	asc: TokenType.Asc,
	desc: TokenType.Desc,
	display: TokenType.Display,
	all: TokenType.All,
	and: TokenType.And,
	or: TokenType.Or,
	not: TokenType.Not,
	in: TokenType.In,
	true: TokenType.True,
	false: TokenType.False,
	null: TokenType.Null,
	today: TokenType.Today,
	yesterday: TokenType.Yesterday,
	tomorrow: TokenType.Tomorrow,
	startOfWeek: TokenType.StartOfWeek,
	endOfWeek: TokenType.EndOfWeek,
};
