/**
 * TQL Lexer - Tokenizes TQL query strings
 */

import {Token, TokenType, KEYWORDS, Span} from "./tokens";

export class LexerError extends Error {
	constructor(
		message: string,
		public span: Span
	) {
		super(message);
		this.name = "LexerError";
	}
}

export class Lexer {
	private input: string;
	private pos: number;
	private tokens: Token[];

	constructor(input: string) {
		this.input = input;
		this.pos = 0;
		this.tokens = [];
	}

	tokenize(): Token[] {
		while (!this.isAtEnd()) {
			this.skipWhitespace();
			if (this.isAtEnd()) break;

			const token = this.scanToken();
			if (token) {
				this.tokens.push(token);
			}
		}

		this.tokens.push({
			type: TokenType.EOF,
			value: "",
			span: {start: this.pos, end: this.pos},
		});

		return this.tokens;
	}

	private scanToken(): Token | null {
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

		// Identifiers and keywords
		if (this.isAlpha(char)) {
			return this.scanIdentifier();
		}

		// Operators and delimiters
		return this.scanOperator(start);
	}

	private scanString(): Token {
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

		return {
			type: TokenType.String,
			value,
			span: {start, end: this.pos},
		};
	}

	private scanNumberOrDate(): Token {
		const start = this.pos;
		
		// Try to match ISO date pattern: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
		const dateToken = this.tryMatchIsoDate(start);
		if (dateToken) {
			return dateToken;
		}

		// Fall back to number/duration parsing
		return this.scanNumber(start);
	}

	private tryMatchIsoDate(start: number): Token | null {
		// Check if we have at least 10 chars for YYYY-MM-DD
		// Pattern: 4 digits, hyphen, 2 digits, hyphen, 2 digits
		const remaining = this.input.slice(this.pos);
		const dateMatch = remaining.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/);
		
		if (!dateMatch) {
			return null;
		}

		const fullMatch = dateMatch[0];
		
		// Validate the date parts are reasonable
		const month = parseInt(dateMatch[2]!, 10);
		const day = parseInt(dateMatch[3]!, 10);
		
		if (month < 1 || month > 12 || day < 1 || day > 31) {
			return null; // Invalid date, parse as number instead
		}

		// If we have time part, validate it too
		if (dateMatch[4] !== undefined) {
			const hours = parseInt(dateMatch[4], 10);
			const minutes = parseInt(dateMatch[5]!, 10);
			const seconds = parseInt(dateMatch[6]!, 10);
			
			if (hours > 23 || minutes > 59 || seconds > 59) {
				return null;
			}
		}

		// Consume the matched characters
		this.pos += fullMatch.length;

		return {
			type: TokenType.DateLiteral,
			value: fullMatch,
			span: {start, end: this.pos},
		};
	}

	private scanNumber(start: number): Token {
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
				// Check it's not part of an identifier
				const afterSuffix = this.peekAt(this.pos + 1);
				if (!this.isAlphaNumeric(afterSuffix)) {
					this.advance(); // consume suffix
					return {
						type: TokenType.Duration,
						value: value + suffix,
						span: {start, end: this.pos},
					};
				}
			}
		}

		return {
			type: TokenType.Number,
			value,
			span: {start, end: this.pos},
		};
	}

	private scanIdentifier(): Token {
		const start = this.pos;
		let value = "";

		while (!this.isAtEnd() && this.isIdentifierChar(this.peek())) {
			value += this.advance();
		}

		// Check if it's a keyword
		const keywordType = KEYWORDS[value];
		if (keywordType !== undefined) {
			// Handle boolean and null as their literal types
			if (keywordType === TokenType.True || keywordType === TokenType.False) {
				return {
					type: TokenType.Boolean,
					value,
					span: {start, end: this.pos},
				};
			}
			if (keywordType === TokenType.Null) {
				return {
					type: TokenType.Null,
					value,
					span: {start, end: this.pos},
				};
			}
			return {
				type: keywordType,
				value,
				span: {start, end: this.pos},
			};
		}

		return {
			type: TokenType.Identifier,
			value,
			span: {start, end: this.pos},
		};
	}

	private scanOperator(start: number): Token {
		const char = this.advance();

		switch (char) {
			case "(":
				return {type: TokenType.LParen, value: "(", span: {start, end: this.pos}};
			case ")":
				return {type: TokenType.RParen, value: ")", span: {start, end: this.pos}};
			case ",":
				return {type: TokenType.Comma, value: ",", span: {start, end: this.pos}};
			case "+":
				return {type: TokenType.Plus, value: "+", span: {start, end: this.pos}};
			case "-":
				return {type: TokenType.Minus, value: "-", span: {start, end: this.pos}};

			case ".":
				if (this.peek() === ".") {
					this.advance();
					return {type: TokenType.DotDot, value: "..", span: {start, end: this.pos}};
				}
				return {type: TokenType.Dot, value: ".", span: {start, end: this.pos}};

			case "=":
				if (this.peek() === "?") {
					this.advance();
					return {type: TokenType.EqNull, value: "=?", span: {start, end: this.pos}};
				}
				return {type: TokenType.Eq, value: "=", span: {start, end: this.pos}};

			case "!":
				if (this.peek() === "=") {
					this.advance();
					if (this.peek() === "?") {
						this.advance();
						return {type: TokenType.NotEqNull, value: "!=?", span: {start, end: this.pos}};
					}
					return {type: TokenType.NotEq, value: "!=", span: {start, end: this.pos}};
				}
				return {type: TokenType.Bang, value: "!", span: {start, end: this.pos}};

			case "<":
				if (this.peek() === "=") {
					this.advance();
					return {type: TokenType.LtEq, value: "<=", span: {start, end: this.pos}};
				}
				return {type: TokenType.Lt, value: "<", span: {start, end: this.pos}};

			case ">":
				if (this.peek() === "=") {
					this.advance();
					return {type: TokenType.GtEq, value: ">=", span: {start, end: this.pos}};
				}
				return {type: TokenType.Gt, value: ">", span: {start, end: this.pos}};

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
		// Support Unicode letters (any language), letter-like symbols (№, ™, etc.), and underscore
		// \p{L} = Letters, \p{So} = Other Symbols (includes №), \p{Sc} = Currency Symbols
		return /^[\p{L}\p{So}\p{Sc}_]$/u.test(char);
	}

	private isAlphaNumeric(char: string): boolean {
		// Support Unicode letters, numbers, and symbols
		return /^[\p{L}\p{N}\p{So}\p{Sc}_]$/u.test(char);
	}

	private isIdentifierChar(char: string): boolean {
		// Support Unicode letters, numbers, symbols, underscore, and hyphen
		return /^[\p{L}\p{N}\p{So}\p{Sc}_-]$/u.test(char);
	}
}

/**
 * Convenience function to tokenize a TQL string
 */
export function tokenize(input: string): Token[] {
	const lexer = new Lexer(input);
	return lexer.tokenize();
}
