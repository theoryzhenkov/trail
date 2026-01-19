/**
 * TQL Parser - Recursive descent parser for TQL queries
 */

import type {
	Query,
	FromClause,
	RelationSpec,
	SortKey,
	DisplayClause,
	Expr,
	PropertyAccess,
	FunctionCall,
	StringLiteral,
	NumberLiteral,
	BooleanLiteral,
	NullLiteral,
	DurationLiteral,
	RelativeDateLiteral,
	DateLiteral,
	DateExpr,
	AggregateExpr,
	AggregateFunc,
	AggregateSource,
	GroupRefExpr,
	InlineFrom,
	BareIdentifier,
} from "./ast";
import type {Token} from "./tokens";
import {TokenType} from "./tokens";
import {ParseError} from "./errors";
import {tokenize} from "./lexer";

export class Parser {
	private tokens: Token[];
	private pos: number;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.pos = 0;
	}

	parse(): Query {
		const start = this.current().span.start;
		const group = this.parseGroupClause();
		const from = this.parseFromClause();
		const prune = this.parsePruneClause();
		const where = this.parseWhereClause();
		const when = this.parseWhenClause();
		const sort = this.parseSortClause();
		const display = this.parseDisplayClause();

		this.expect(TokenType.EOF, "end of query");

		return {
			type: "query",
			group,
			from,
			prune,
			where,
			when,
			sort,
			display,
			span: {start, end: this.previous().span.end},
		};
	}

	// =========================================================================
	// Clause Parsing
	// =========================================================================

	private parseGroupClause(): string {
		this.expect(TokenType.Group, '"group"');
		const nameToken = this.expect(TokenType.String, "group name string");
		return this.parseStringValue(nameToken);
	}

	private parseFromClause(): FromClause {
		const start = this.current().span.start;
		this.expect(TokenType.From, '"from"');

		const relations: RelationSpec[] = [];
		relations.push(this.parseRelationSpec());

		while (this.match(TokenType.Comma)) {
			relations.push(this.parseRelationSpec());
		}

		return {
			type: "from",
			relations,
			span: {start, end: this.previous().span.end},
		};
	}

	private parseRelationSpec(): RelationSpec {
		const start = this.current().span.start;
		const nameToken = this.expect(TokenType.Identifier, "relation name");
		const name = nameToken.value;

		let depth: number | "unlimited" = "unlimited";
		let extend: string | undefined;
		let flatten: boolean | undefined;

		// Parse modifiers in any order
		while (this.check(TokenType.Depth) || this.check(TokenType.Extend) || this.check(TokenType.Flatten)) {
			if (this.match(TokenType.Depth)) {
				if (this.match(TokenType.Unlimited)) {
					depth = "unlimited";
				} else {
					const depthToken = this.expect(TokenType.Number, "depth number");
					depth = parseInt(depthToken.value, 10);
				}
			} else if (this.match(TokenType.Extend)) {
				if (this.check(TokenType.String)) {
					const extendToken = this.advance();
					extend = this.parseStringValue(extendToken);
				} else {
					const extendToken = this.expect(TokenType.Identifier, "group name");
					extend = extendToken.value;
				}
			} else if (this.match(TokenType.Flatten)) {
				flatten = true;
			}
		}

		return {
			type: "relationSpec",
			name,
			depth,
			extend,
			flatten,
			span: {start, end: this.previous().span.end},
		};
	}

	private parsePruneClause(): Expr | undefined {
		if (!this.match(TokenType.Prune)) {
			return undefined;
		}
		return this.parseExpression();
	}

	private parseWhereClause(): Expr | undefined {
		if (!this.match(TokenType.Where)) {
			return undefined;
		}
		return this.parseExpression();
	}

	private parseWhenClause(): Expr | undefined {
		if (!this.match(TokenType.When)) {
			return undefined;
		}
		return this.parseExpression();
	}

	private parseSortClause(): SortKey[] | undefined {
		if (!this.match(TokenType.Sort)) {
			return undefined;
		}
		this.expect(TokenType.By, '"by"');

		const keys: SortKey[] = [];
		keys.push(this.parseSortKey());

		while (this.match(TokenType.Comma)) {
			keys.push(this.parseSortKey());
		}

		return keys;
	}

	private parseSortKey(): SortKey {
		const start = this.current().span.start;
		let key: "chain" | PropertyAccess;

		if (this.match(TokenType.Chain)) {
			key = "chain";
		} else {
			key = this.parsePropertyAccess();
		}

		let direction: "asc" | "desc" = "asc";
		if (this.match(TokenType.Asc)) {
			direction = "asc";
		} else if (this.match(TokenType.Desc)) {
			direction = "desc";
		}

		return {
			type: "sortKey",
			key,
			direction,
			span: {start, end: this.previous().span.end},
		};
	}

	private parseDisplayClause(): DisplayClause | undefined {
		if (!this.match(TokenType.Display)) {
			return undefined;
		}

		const start = this.previous().span.start;
		const properties: PropertyAccess[] = [];
		let all = false;

		if (this.match(TokenType.All)) {
			all = true;
			// Additional properties after "all"
			while (this.match(TokenType.Comma)) {
				properties.push(this.parsePropertyAccess());
			}
		} else {
			properties.push(this.parsePropertyAccess());
			while (this.match(TokenType.Comma)) {
				properties.push(this.parsePropertyAccess());
			}
		}

		return {
			type: "display",
			all,
			properties,
			span: {start, end: this.previous().span.end},
		};
	}

	// =========================================================================
	// Expression Parsing (Precedence Climbing)
	// =========================================================================

	private parseExpression(): Expr {
		return this.parseOrExpr();
	}

	private parseOrExpr(): Expr {
		let left = this.parseAndExpr();

		while (this.match(TokenType.Or)) {
			const right = this.parseAndExpr();
			left = {
				type: "logical",
				op: "or",
				left,
				right,
				span: {start: left.span.start, end: right.span.end},
			};
		}

		return left;
	}

	private parseAndExpr(): Expr {
		let left = this.parseNotExpr();

		while (this.match(TokenType.And)) {
			const right = this.parseNotExpr();
			left = {
				type: "logical",
				op: "and",
				left,
				right,
				span: {start: left.span.start, end: right.span.end},
			};
		}

		return left;
	}

	private parseNotExpr(): Expr {
		if (this.match(TokenType.Not) || this.match(TokenType.Bang)) {
			const start = this.previous().span.start;
			const operand = this.parseNotExpr();
			return {
				type: "unary",
				op: "not",
				operand,
				span: {start, end: operand.span.end},
			};
		}

		return this.parseCompareExpr();
	}

	private parseCompareExpr(): Expr {
		let left = this.parseArithExpr();

		// Check for "in" expression (can be membership or range)
		if (this.match(TokenType.In)) {
			const start = left.span.start;
			const collection = this.parseArithExpr();

			// Check for range expression: value in lower..upper
			if (this.match(TokenType.DotDot)) {
				const upper = this.parseArithExpr();
				return {
					type: "range",
					value: left,
					lower: collection,
					upper,
					span: {start, end: upper.span.end},
				};
			}

			return {
				type: "in",
				value: left,
				collection,
				span: {start, end: collection.span.end},
			};
		}

		// Check for comparison operators
		const opToken = this.matchCompareOp();
		if (opToken) {
			const right = this.parseArithExpr();
			return {
				type: "compare",
				op: this.tokenToCompareOp(opToken.type),
				left,
				right,
				span: {start: left.span.start, end: right.span.end},
			};
		}

		return left;
	}

	private parseArithExpr(): Expr {
		let left = this.parseTerm();

		while (this.check(TokenType.Plus) || this.check(TokenType.Minus)) {
			const op = this.advance();
			const right = this.parseTerm();
			left = {
				type: "arith",
				op: op.type === TokenType.Plus ? "+" : "-",
				left,
				right,
				span: {start: left.span.start, end: right.span.end},
			};
		}

		return left;
	}

	private parseTerm(): Expr {
		// Parenthesized expression
		if (this.match(TokenType.LParen)) {
			const expr = this.parseExpression();
			this.expect(TokenType.RParen, '")"');
			return expr;
		}

		// String literal
		if (this.check(TokenType.String)) {
			return this.parseStringLiteral();
		}

		// Number literal
		if (this.check(TokenType.Number)) {
			return this.parseNumberLiteral();
		}

		// Duration literal
		if (this.check(TokenType.Duration)) {
			return this.parseDurationLiteral();
		}

		// Boolean literal
		if (this.check(TokenType.Boolean)) {
			return this.parseBooleanLiteral();
		}

		// Null literal
		if (this.check(TokenType.Null)) {
			return this.parseNullLiteral();
		}

		// Date literals (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
		if (this.check(TokenType.DateLiteral)) {
			return this.parseDateExpr();
		}

		// Relative date literals
		if (this.isRelativeDate()) {
			return this.parseDateExpr();
		}

		// Function call or property access
		if (this.check(TokenType.Identifier)) {
			// Look ahead to see if this is a function call
			if (this.checkNext(TokenType.LParen)) {
				return this.parseFunctionCall();
			}
			return this.parsePropertyAccess();
		}

		// Handle aggregate functions that are keywords (like "all")
		if (this.isAggregateKeyword() && this.checkNext(TokenType.LParen)) {
			return this.parseFunctionCall();
		}

		throw new ParseError(
			`Unexpected token: ${this.current().value}`,
			this.current().span,
			["expression"]
		);
	}

	// =========================================================================
	// Literal Parsing
	// =========================================================================

	private parseStringLiteral(): StringLiteral {
		const token = this.advance();
		return {
			type: "string",
			value: this.parseStringValue(token),
			span: token.span,
		};
	}

	private parseNumberLiteral(): NumberLiteral {
		const token = this.advance();
		return {
			type: "number",
			value: parseFloat(token.value),
			span: token.span,
		};
	}

	private parseDurationLiteral(): DurationLiteral {
		const token = this.advance();
		const match = token.value.match(/^(\d+(?:\.\d+)?)([dwmy])$/);
		if (!match || !match[1] || !match[2]) {
			throw new ParseError(`Invalid duration: ${token.value}`, token.span);
		}
		return {
			type: "duration",
			value: parseFloat(match[1]),
			unit: match[2] as "d" | "w" | "m" | "y",
			span: token.span,
		};
	}

	private parseBooleanLiteral(): BooleanLiteral {
		const token = this.advance();
		return {
			type: "boolean",
			value: token.value === "true",
			span: token.span,
		};
	}

	private parseNullLiteral(): NullLiteral {
		const token = this.advance();
		return {
			type: "null",
			span: token.span,
		};
	}

	private parseDateExpr(): DateExpr {
		const start = this.current().span.start;
		let base: RelativeDateLiteral | DateLiteral | PropertyAccess;

		if (this.check(TokenType.DateLiteral)) {
			base = this.parseDateLiteral();
		} else if (this.isRelativeDate()) {
			base = this.parseRelativeDate();
		} else {
			throw new ParseError("Expected date expression", this.current().span);
		}

		// Check for offset
		let offset: DateExpr["offset"];
		if (this.check(TokenType.Plus) || this.check(TokenType.Minus)) {
			const op = this.advance();
			const duration = this.parseDurationLiteral();
			offset = {
				op: op.type === TokenType.Plus ? "+" : "-",
				duration,
			};
		}

		return {
			type: "dateExpr",
			base,
			offset,
			span: {start, end: this.previous().span.end},
		};
	}

	private parseDateLiteral(): DateLiteral {
		const token = this.advance();
		// Parse ISO date string into Date object
		const date = new Date(token.value);
		if (isNaN(date.getTime())) {
			throw new ParseError(`Invalid date: ${token.value}`, token.span);
		}
		return {
			type: "date",
			value: date,
			span: token.span,
		};
	}

	private parseRelativeDate(): RelativeDateLiteral {
		const token = this.advance();
		const kindMap: Partial<Record<TokenType, RelativeDateLiteral["kind"]>> = {
			[TokenType.Today]: "today",
			[TokenType.Yesterday]: "yesterday",
			[TokenType.Tomorrow]: "tomorrow",
			[TokenType.StartOfWeek]: "startOfWeek",
			[TokenType.EndOfWeek]: "endOfWeek",
		};
		return {
			type: "relativeDate",
			kind: kindMap[token.type] ?? "today",
			span: token.span,
		};
	}

	// =========================================================================
	// Property and Function Parsing
	// =========================================================================

	private parsePropertyAccess(): PropertyAccess {
		const start = this.current().span.start;
		const path: string[] = [];

		// First part
		const first = this.expect(TokenType.Identifier, "property name");
		path.push(first.value);

		// Dotted parts
		while (this.match(TokenType.Dot)) {
			const part = this.expect(TokenType.Identifier, "property name");
			path.push(part.value);
		}

		return {
			type: "property",
			path,
			span: {start, end: this.previous().span.end},
		};
	}

	private parseFunctionCall(): FunctionCall | AggregateExpr {
		const name = this.current().value;

		// Check if this is an aggregate function
		if (this.isAggregate(name)) {
			return this.parseAggregateExpr(name as AggregateFunc);
		}

		// Regular function call
		const start = this.current().span.start;
		// Handle "all" keyword or regular identifier
		let nameToken: Token;
		if (this.check(TokenType.All)) {
			nameToken = this.advance();
		} else {
			nameToken = this.expect(TokenType.Identifier, "function name");
		}

		this.expect(TokenType.LParen, '"("');

		const args: Expr[] = [];
		if (!this.check(TokenType.RParen)) {
			args.push(this.parseExpression());
			while (this.match(TokenType.Comma)) {
				args.push(this.parseExpression());
			}
		}

		this.expect(TokenType.RParen, '")"');

		return {
			type: "call",
			name: nameToken.value,
			args,
			span: {start, end: this.previous().span.end},
		};
	}

	// =========================================================================
	// Aggregate Parsing
	// =========================================================================

	private isAggregate(name: string): boolean {
		return ["count", "sum", "avg", "min", "max", "any", "all"].includes(name);
	}

	/**
	 * Check if current token is an aggregate function keyword (like "all")
	 */
	private isAggregateKeyword(): boolean {
		return this.check(TokenType.All); // "all" is the only aggregate that's a keyword
	}

	private parseAggregateExpr(func: AggregateFunc): AggregateExpr {
		const start = this.current().span.start;
		this.advance(); // consume function name
		this.expect(TokenType.LParen, '"("');

		// Parse source: "from ...", "group(...)", or bare identifier
		let source: AggregateSource;
		if (this.match(TokenType.From)) {
			source = this.parseInlineFrom();
		} else if (this.check(TokenType.Group)) {
			// "group" keyword followed by "(" for group("Name") syntax
			source = this.parseGroupRefExpr();
		} else if (this.check(TokenType.Identifier)) {
			// Bare identifier - could be group or relation, resolved at validation
			source = this.parseBareIdentifier();
		} else {
			throw new ParseError(
				'Expected "from", "group()", or identifier in aggregate function',
				this.current().span,
				["from", "group()", "identifier"]
			);
		}

		// Parse optional second argument (property for sum/avg/min/max, condition for any/all)
		let property: PropertyAccess | undefined;
		let condition: Expr | undefined;

		if (this.match(TokenType.Comma)) {
			if (func === "any" || func === "all") {
				condition = this.parseExpression();
			} else if (func === "sum" || func === "avg" || func === "min" || func === "max") {
				property = this.parsePropertyAccess();
			}
			// For count, extra arguments are ignored (could add warning)
		}

		this.expect(TokenType.RParen, '")"');

		return {
			type: "aggregate",
			func,
			source,
			property,
			condition,
			span: {start, end: this.previous().span.end},
		};
	}

	private parseGroupRefExpr(): GroupRefExpr {
		const start = this.current().span.start;
		this.expect(TokenType.Group, '"group"'); // consume "group" keyword
		this.expect(TokenType.LParen, '"("');
		const nameToken = this.expect(TokenType.String, "group name string");
		const name = this.parseStringValue(nameToken);
		this.expect(TokenType.RParen, '")"');

		return {
			type: "groupRef",
			name,
			span: {start, end: this.previous().span.end},
		};
	}

	private parseInlineFrom(): InlineFrom {
		const start = this.previous().span.start; // "from" was already consumed

		const relations: RelationSpec[] = [];
		relations.push(this.parseRelationSpec());

		// For inline from in aggregates, only parse additional relations if clearly a relation spec
		// An identifier followed by depth/extend is clearly a relation
		// An identifier NOT followed by depth/extend before comma/rparen is ambiguous - treat as end of inline from
		while (this.check(TokenType.Comma) && this.looksLikeMoreRelations()) {
			this.advance(); // consume comma
			relations.push(this.parseRelationSpec());
		}

		return {
			type: "inlineFrom",
			relations,
			span: {start, end: this.previous().span.end},
		};
	}

	/**
	 * Check if what follows a comma looks like another relation spec
	 * A relation spec is: identifier followed by "depth" or "extend" modifiers
	 * An identifier immediately followed by comma or rparen is ambiguous - could be a simple relation
	 * or a property argument for the aggregate
	 * 
	 * We only continue if the next identifier has explicit modifiers (depth/extend)
	 */
	private looksLikeMoreRelations(): boolean {
		// Save position
		const savedPos = this.pos;
		
		// Skip past the comma
		this.pos++;
		
		// Check if current token is an identifier
		if (!this.check(TokenType.Identifier)) {
			this.pos = savedPos;
			return false;
		}
		
		// Skip past the identifier
		this.pos++;
		
		// Only consider it a relation spec if followed by depth or extend
		// This disambiguates: "sum(from down, value)" - value is NOT a relation
		// vs "count(from down depth 1, up depth 2)" - up IS a relation (has depth modifier)
		const hasRelationModifier = 
			this.check(TokenType.Depth) ||
			this.check(TokenType.Extend);
		
		// Restore position
		this.pos = savedPos;
		
		return hasRelationModifier;
	}

	private parseBareIdentifier(): BareIdentifier {
		const token = this.expect(TokenType.Identifier, "group or relation name");
		return {
			type: "bareIdentifier",
			name: token.value,
			span: token.span,
		};
	}

	// =========================================================================
	// Helper Methods
	// =========================================================================

	private parseStringValue(token: Token): string {
		// The lexer already handles escape sequences, so just return the value
		return token.value;
	}

	private matchCompareOp(): Token | null {
		const ops = [
			TokenType.Eq,
			TokenType.NotEq,
			TokenType.Lt,
			TokenType.Gt,
			TokenType.LtEq,
			TokenType.GtEq,
			TokenType.EqNull,
			TokenType.NotEqNull,
		];
		for (const op of ops) {
			if (this.match(op)) {
				return this.previous();
			}
		}
		return null;
	}

	private tokenToCompareOp(type: TokenType): "=" | "!=" | "<" | ">" | "<=" | ">=" | "=?" | "!=?" {
		const map: Partial<Record<TokenType, "=" | "!=" | "<" | ">" | "<=" | ">=" | "=?" | "!=?">> = {
			[TokenType.Eq]: "=",
			[TokenType.NotEq]: "!=",
			[TokenType.Lt]: "<",
			[TokenType.Gt]: ">",
			[TokenType.LtEq]: "<=",
			[TokenType.GtEq]: ">=",
			[TokenType.EqNull]: "=?",
			[TokenType.NotEqNull]: "!=?",
		};
		return map[type] ?? "=";
	}

	private isRelativeDate(): boolean {
		return (
			this.check(TokenType.Today) ||
			this.check(TokenType.Yesterday) ||
			this.check(TokenType.Tomorrow) ||
			this.check(TokenType.StartOfWeek) ||
			this.check(TokenType.EndOfWeek)
		);
	}

	private current(): Token {
		return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1]!;
	}

	private previous(): Token {
		return this.tokens[this.pos - 1] ?? this.tokens[0]!;
	}

	private check(type: TokenType): boolean {
		return this.current().type === type;
	}

	private checkNext(type: TokenType): boolean {
		const next = this.tokens[this.pos + 1];
		return next?.type === type;
	}

	private match(type: TokenType): boolean {
		if (this.check(type)) {
			this.advance();
			return true;
		}
		return false;
	}

	private advance(): Token {
		if (!this.isAtEnd()) {
			this.pos++;
		}
		return this.previous();
	}

	private isAtEnd(): boolean {
		return this.current().type === TokenType.EOF;
	}

	private expect(type: TokenType, expected: string): Token {
		if (this.check(type)) {
			return this.advance();
		}
		throw new ParseError(
			`Expected ${expected}, got "${this.current().value}"`,
			this.current().span,
			[expected]
		);
	}
}

/**
 * Parse a TQL query string into an AST
 */
export function parse(input: string): Query {
	const tokens = tokenize(input);
	const parser = new Parser(tokens);
	return parser.parse();
}
