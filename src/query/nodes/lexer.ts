/**
 * TQL Lexer - Tokenizes TQL query strings into TokenNode instances
 * 
 * This is the new lexer that outputs class instances instead of plain objects.
 */

import type {Span} from "./types";
import {TokenNode} from "./base/TokenNode";
import {
	// Keywords
	GroupToken, FromToken, WhereToken, WhenToken, PruneToken, SortToken, DisplayToken,
	DepthToken, UnlimitedToken, ExtendToken, FlattenToken,
	AscToken, DescToken, AllToken,
	AndToken, OrToken, NotToken, InToken,
	TrueToken, FalseToken, NullToken,
	TodayToken, YesterdayToken, TomorrowToken, StartOfWeekToken, EndOfWeekToken,
	// Operators
	EqToken, NotEqToken, LtToken, GtToken, LtEqToken, GtEqToken,
	EqNullToken, NotEqNullToken, PlusToken, MinusToken, BangToken, DotDotToken,
	// Delimiters
	LParenToken, RParenToken, CommaToken, DotToken,
	// Special
	EOFToken, StringToken, NumberToken, BooleanToken, DurationToken,
	DateLiteralToken, IdentifierToken, BuiltinIdentifierToken,
} from "./tokens";

export class LexerError extends Error {
	constructor(
		message: string,
		public span: Span
	) {
		super(message);
		this.name = "LexerError";
	}
}

/**
 * Keyword map - lowercase keyword to token class
 */
const KEYWORDS: Record<string, new (value: string, span: Span) => TokenNode> = {
	group: GroupToken,
	from: FromToken,
	where: WhereToken,
	when: WhenToken,
	prune: PruneToken,
	sort: SortToken,
	display: DisplayToken,
	depth: DepthToken,
	unlimited: UnlimitedToken,
	extend: ExtendToken,
	flatten: FlattenToken,
	asc: AscToken,
	desc: DescToken,
	all: AllToken,
	and: AndToken,
	or: OrToken,
	not: NotToken,
	in: InToken,
	true: TrueToken,
	false: FalseToken,
	null: NullToken,
	today: TodayToken,
	yesterday: YesterdayToken,
	tomorrow: TomorrowToken,
	startofweek: StartOfWeekToken,
	endofweek: EndOfWeekToken,
};

export class Lexer {
	private input: string;
	private pos: number;
	private tokens: TokenNode[];

	constructor(input: string) {
		this.input = input;
		this.pos = 0;
		this.tokens = [];
	}

	tokenize(): TokenNode[] {
		while (!this.isAtEnd()) {
			this.skipWhitespace();
			if (this.isAtEnd()) break;

			const token = this.scanToken();
			if (token) {
				this.tokens.push(token);
			}
		}

		this.tokens.push(new EOFToken("", {start: this.pos, end: this.pos}));
		return this.tokens;
	}

	private scanToken(): TokenNode | null {
		const start = this.pos;
		const char = this.peek();

		// String literals
		if (char === '"') {
			return this.scanString();
		}

		// Numbers, durations, or ISO dates
		if (this.isDigit(char)) {
			return this.scanNumberOrDate();
		}

		// Built-in identifiers ($file, $traversal, $chain)
		if (char === '$') {
			return this.scanBuiltinIdentifier();
		}

		// Identifiers and keywords
		if (this.isAlpha(char)) {
			return this.scanIdentifier();
		}

		// Operators and delimiters
		return this.scanOperator(start);
	}

	private scanString(): TokenNode {
		const start = this.pos;
		this.advance(); // consume opening quote

		let value = "";
		while (!this.isAtEnd() && this.peek() !== '"') {
			if (this.peek() === "\\") {
				this.advance();
				if (this.isAtEnd()) {
					throw new LexerError("Unterminated escape sequence", {
						start: this.pos - 1,
						end: this.pos,
					});
				}
				const escaped = this.advance();
				switch (escaped) {
					case "\\":
						value += "\\";
						break;
					case '"':
						value += '"';
						break;
					case "n":
						value += "\n";
						break;
					case "t":
						value += "\t";
						break;
					default:
						throw new LexerError(`Invalid escape sequence: \\${escaped}`, {
							start: this.pos - 2,
							end: this.pos,
						});
				}
			} else {
				value += this.advance();
			}
		}

		if (this.isAtEnd()) {
			throw new LexerError("Unterminated string", {start, end: this.pos});
		}

		this.advance(); // consume closing quote

		return new StringToken(value, {start, end: this.pos});
	}

	private scanNumberOrDate(): TokenNode {
		const start = this.pos;

		// Try to match ISO date pattern: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
		const dateToken = this.tryMatchIsoDate(start);
		if (dateToken) {
			return dateToken;
		}

		// Fall back to number/duration parsing
		return this.scanNumber(start);
	}

	private tryMatchIsoDate(start: number): TokenNode | null {
		const remaining = this.input.slice(this.pos);
		const dateMatch = remaining.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/);

		if (!dateMatch) {
			return null;
		}

		const fullMatch = dateMatch[0];

		// Validate the date parts
		const month = parseInt(dateMatch[2]!, 10);
		const day = parseInt(dateMatch[3]!, 10);

		if (month < 1 || month > 12 || day < 1 || day > 31) {
			return null;
		}

		// Validate time if present
		if (dateMatch[4] !== undefined) {
			const hours = parseInt(dateMatch[4], 10);
			const minutes = parseInt(dateMatch[5]!, 10);
			const seconds = parseInt(dateMatch[6]!, 10);

			if (hours > 23 || minutes > 59 || seconds > 59) {
				return null;
			}
		}

		this.pos += fullMatch.length;
		return new DateLiteralToken(fullMatch, {start, end: this.pos});
	}

	private scanNumber(start: number): TokenNode {
		let value = "";

		// Integer part
		while (!this.isAtEnd() && this.isDigit(this.peek())) {
			value += this.advance();
		}

		// Decimal part
		if (!this.isAtEnd() && this.peek() === "." && this.isDigit(this.peekNext())) {
			value += this.advance(); // consume '.'
			while (!this.isAtEnd() && this.isDigit(this.peek())) {
				value += this.advance();
			}
		}

		// Check for duration suffix
		if (!this.isAtEnd()) {
			const suffix = this.peek();
			if (suffix === "d" || suffix === "w" || suffix === "m" || suffix === "y") {
				const afterSuffix = this.peekAt(this.pos + 1);
				if (!this.isAlphaNumeric(afterSuffix)) {
					this.advance();
					return new DurationToken(value + suffix, {start, end: this.pos});
				}
			}
		}

		return new NumberToken(value, {start, end: this.pos});
	}

	private scanIdentifier(): TokenNode {
		const start = this.pos;
		let value = "";

		while (!this.isAtEnd() && this.isIdentifierChar(this.peek())) {
			value += this.advance();
		}

		// Check if it's a keyword
		const lowerValue = value.toLowerCase();
		const KeywordClass = KEYWORDS[lowerValue];

		if (KeywordClass) {
			// Handle boolean literals specially
			if (KeywordClass === TrueToken || KeywordClass === FalseToken) {
				return new BooleanToken(value, {start, end: this.pos});
			}
			return new KeywordClass(value, {start, end: this.pos});
		}

		return new IdentifierToken(value, {start, end: this.pos});
	}

	private scanBuiltinIdentifier(): TokenNode {
		const start = this.pos;
		this.advance(); // consume '$'

		// Read the identifier part after $
		let value = "$";
		while (!this.isAtEnd() && this.isIdentifierChar(this.peek())) {
			value += this.advance();
		}

		if (value === "$") {
			throw new LexerError("Expected identifier after '$'", {start, end: this.pos});
		}

		return new BuiltinIdentifierToken(value, {start, end: this.pos});
	}

	private scanOperator(start: number): TokenNode {
		const char = this.advance();

		switch (char) {
			case "(":
				return new LParenToken("(", {start, end: this.pos});
			case ")":
				return new RParenToken(")", {start, end: this.pos});
			case ",":
				return new CommaToken(",", {start, end: this.pos});
			case "+":
				return new PlusToken("+", {start, end: this.pos});
			case "-":
				return new MinusToken("-", {start, end: this.pos});

			case ".":
				if (this.peek() === ".") {
					this.advance();
					return new DotDotToken("..", {start, end: this.pos});
				}
				return new DotToken(".", {start, end: this.pos});

			case "=":
				if (this.peek() === "?") {
					this.advance();
					return new EqNullToken("=?", {start, end: this.pos});
				}
				return new EqToken("=", {start, end: this.pos});

			case "!":
				if (this.peek() === "=") {
					this.advance();
					if (this.peek() === "?") {
						this.advance();
						return new NotEqNullToken("!=?", {start, end: this.pos});
					}
					return new NotEqToken("!=", {start, end: this.pos});
				}
				return new BangToken("!", {start, end: this.pos});

			case "<":
				if (this.peek() === "=") {
					this.advance();
					return new LtEqToken("<=", {start, end: this.pos});
				}
				return new LtToken("<", {start, end: this.pos});

			case ">":
				if (this.peek() === "=") {
					this.advance();
					return new GtEqToken(">=", {start, end: this.pos});
				}
				return new GtToken(">", {start, end: this.pos});

			default:
				throw new LexerError(`Unexpected character: ${char}`, {
					start,
					end: this.pos,
				});
		}
	}

	private skipWhitespace(): void {
		while (!this.isAtEnd() && this.isWhitespace(this.peek())) {
			this.advance();
		}
	}

	private isAtEnd(): boolean {
		return this.pos >= this.input.length;
	}

	private peek(): string {
		return this.input[this.pos] ?? "";
	}

	private peekNext(): string {
		return this.input[this.pos + 1] ?? "";
	}

	private peekAt(index: number): string {
		return this.input[index] ?? "";
	}

	private advance(): string {
		return this.input[this.pos++] ?? "";
	}

	private isWhitespace(char: string): boolean {
		return char === " " || char === "\t" || char === "\n" || char === "\r";
	}

	private isDigit(char: string): boolean {
		return char >= "0" && char <= "9";
	}

	private isAlpha(char: string): boolean {
		return /^[\p{L}\p{So}\p{Sc}_]$/u.test(char);
	}

	private isAlphaNumeric(char: string): boolean {
		return /^[\p{L}\p{N}\p{So}\p{Sc}_]$/u.test(char);
	}

	private isIdentifierChar(char: string): boolean {
		return /^[\p{L}\p{N}\p{So}\p{Sc}_-]$/u.test(char);
	}
}

/**
 * Convenience function to tokenize a TQL string
 */
export function tokenize(input: string): TokenNode[] {
	const lexer = new Lexer(input);
	return lexer.tokenize();
}
