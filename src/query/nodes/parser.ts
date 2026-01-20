/**
 * TQL Parser - Recursive descent parser that creates node class instances
 * 
 * This parser produces a tree of node class instances, not plain AST objects.
 */

import type {Span} from "./types";
import {TokenNode} from "./base/TokenNode";
import {ExprNode} from "./base/ExprNode";
import {tokenize, LexerError} from "./lexer";

// Token classes for type checking
import {
	GroupToken, FromToken, WhereToken, WhenToken, PruneToken, SortToken, DisplayToken,
	DepthToken, UnlimitedToken, ExtendToken, FlattenToken,
	AscToken, DescToken, AllToken,
	AndToken, OrToken, NotToken, InToken,
	TrueToken, FalseToken, NullToken,
	TodayToken, YesterdayToken, TomorrowToken, StartOfWeekToken, EndOfWeekToken,
	EqToken, NotEqToken, LtToken, GtToken, LtEqToken, GtEqToken,
	EqNullToken, NotEqNullToken, PlusToken, MinusToken, BangToken, DotDotToken,
	LParenToken, RParenToken, CommaToken, DotToken,
	EOFToken, StringToken, NumberToken, BooleanToken, DurationToken,
	DateLiteralToken, IdentifierToken, BuiltinIdentifierToken,
} from "./tokens";

// Node classes
import {QueryNode, FromNode, RelationSpecNode, SortNode, SortKeyNode, DisplayNode} from "./clauses";
import {
	LogicalNode, CompareNode, ArithNode, UnaryNotNode, InNode, RangeNode,
	PropertyNode, CallNode, AggregateNode, DateExprNode,
	type CompareOp, type AggregateFunc, type AggregateSource,
	type GroupRefSource, type InlineFromSource, type BareIdentifierSource,
} from "./expressions";
import {
	StringNode, NumberNode, BooleanNode, NullNode, DurationNode,
	DateLiteralNode, RelativeDateNode,
	type DurationUnit, type RelativeDateKind,
} from "./literals";

export class ParseError extends Error {
	constructor(
		message: string,
		public span: Span,
		public expected?: string[]
	) {
		super(message);
		this.name = "ParseError";
	}
}

export class Parser {
	private tokens: TokenNode[];
	private pos: number;

	constructor(tokens: TokenNode[]) {
		this.tokens = tokens;
		this.pos = 0;
	}

	parse(): QueryNode {
		const start = this.current().span.start;
		const group = this.parseGroupClause();
		const from = this.parseFromClause();
		const prune = this.parsePruneClause();
		const where = this.parseWhereClause();
		const when = this.parseWhenClause();
		const sort = this.parseSortClause();
		const display = this.parseDisplayClause();

		this.expect(EOFToken, "end of query");

		const span = {start, end: this.previous().span.end};
		return new QueryNode(group, from, span, prune, where, when, sort, display);
	}

	// =========================================================================
	// Clause Parsing
	// =========================================================================

	private parseGroupClause(): string {
		this.expect(GroupToken, '"group"');
		const nameToken = this.expect(StringToken, "group name string");
		return nameToken.value;
	}

	private parseFromClause(): FromNode {
		const start = this.current().span.start;
		this.expect(FromToken, '"from"');

		const relations: RelationSpecNode[] = [];
		relations.push(this.parseRelationSpec());

		while (this.match(CommaToken)) {
			relations.push(this.parseRelationSpec());
		}

		return new FromNode(relations, {start, end: this.previous().span.end});
	}

	private parseRelationSpec(): RelationSpecNode {
		const start = this.current().span.start;
		const nameToken = this.expect(IdentifierToken, "relation name");
		const name = nameToken.value;

		let depth: number | "unlimited" = "unlimited";
		let extend: string | undefined;
		let flatten: number | true | undefined;

		// Parse modifiers in any order
		while (this.check(DepthToken) || this.check(ExtendToken) || this.check(FlattenToken)) {
			if (this.match(DepthToken)) {
				if (this.match(UnlimitedToken)) {
					depth = "unlimited";
				} else {
					const depthToken = this.expect(NumberToken, "depth number");
					depth = parseInt(depthToken.value, 10);
				}
			} else if (this.match(ExtendToken)) {
				if (this.check(StringToken)) {
					extend = this.advance().value;
				} else {
					extend = this.expect(IdentifierToken, "group name").value;
				}
			} else if (this.match(FlattenToken)) {
				// Check for optional depth number after flatten
				if (this.check(NumberToken)) {
					flatten = parseInt(this.advance().value, 10);
				} else {
					flatten = true;
				}
			}
		}

		return new RelationSpecNode(name, depth, {start, end: this.previous().span.end}, extend, flatten);
	}

	private parsePruneClause(): ExprNode | undefined {
		if (!this.match(PruneToken)) {
			return undefined;
		}
		return this.parseExpression();
	}

	private parseWhereClause(): ExprNode | undefined {
		if (!this.match(WhereToken)) {
			return undefined;
		}
		return this.parseExpression();
	}

	private parseWhenClause(): ExprNode | undefined {
		if (!this.match(WhenToken)) {
			return undefined;
		}
		return this.parseExpression();
	}

	private parseSortClause(): SortNode | undefined {
		if (!this.match(SortToken)) {
			return undefined;
		}
		const start = this.previous().span.start;

		const keys: SortKeyNode[] = [];
		keys.push(this.parseSortKey());

		while (this.match(CommaToken)) {
			keys.push(this.parseSortKey());
		}

		return new SortNode(keys, {start, end: this.previous().span.end});
	}

	private parseSortKey(): SortKeyNode {
		const start = this.current().span.start;
		let key: "chain" | PropertyNode;

		// Check for $chain (built-in chain sort)
		if (this.check(BuiltinIdentifierToken) && this.current().value === "$chain") {
			this.advance();
			key = "chain";
		} else if (this.check(BuiltinIdentifierToken)) {
			// Other built-in properties like $file.modified
			key = this.parseBuiltinPropertyAccess();
		} else {
			key = this.parsePropertyAccess();
		}

		let direction: "asc" | "desc" = "asc";
		if (this.match(AscToken)) {
			direction = "asc";
		} else if (this.match(DescToken)) {
			direction = "desc";
		}

		return new SortKeyNode(key, direction, {start, end: this.previous().span.end});
	}

	private parseDisplayClause(): DisplayNode | undefined {
		if (!this.match(DisplayToken)) {
			return undefined;
		}

		const start = this.previous().span.start;
		const properties: PropertyNode[] = [];
		let all = false;

		if (this.match(AllToken)) {
			all = true;
			while (this.match(CommaToken)) {
				properties.push(this.parsePropertyAccess());
			}
		} else {
			properties.push(this.parsePropertyAccess());
			while (this.match(CommaToken)) {
				properties.push(this.parsePropertyAccess());
			}
		}

		return new DisplayNode(all, properties, {start, end: this.previous().span.end});
	}

	// =========================================================================
	// Expression Parsing (Precedence Climbing)
	// =========================================================================

	private parseExpression(): ExprNode {
		return this.parseOrExpr();
	}

	private parseOrExpr(): ExprNode {
		let left = this.parseAndExpr();

		while (this.match(OrToken)) {
			const right = this.parseAndExpr();
			left = new LogicalNode("or", left, right, {start: left.span.start, end: right.span.end});
		}

		return left;
	}

	private parseAndExpr(): ExprNode {
		let left = this.parseNotExpr();

		while (this.match(AndToken)) {
			const right = this.parseNotExpr();
			left = new LogicalNode("and", left, right, {start: left.span.start, end: right.span.end});
		}

		return left;
	}

	private parseNotExpr(): ExprNode {
		if (this.match(NotToken) || this.match(BangToken)) {
			const start = this.previous().span.start;
			const operand = this.parseNotExpr();
			return new UnaryNotNode(operand, {start, end: operand.span.end});
		}

		return this.parseCompareExpr();
	}

	private parseCompareExpr(): ExprNode {
		let left = this.parseArithExpr();

		// Check for "in" expression
		if (this.match(InToken)) {
			const start = left.span.start;
			const collection = this.parseArithExpr();

			// Check for range expression: value in lower..upper
			if (this.match(DotDotToken)) {
				const upper = this.parseArithExpr();
				return new RangeNode(left, collection, upper, {start, end: upper.span.end});
			}

			return new InNode(left, collection, {start, end: collection.span.end});
		}

		// Check for comparison operators
		const opToken = this.matchCompareOp();
		if (opToken) {
			const right = this.parseArithExpr();
			return new CompareNode(
				this.tokenToCompareOp(opToken),
				left,
				right,
				{start: left.span.start, end: right.span.end}
			);
		}

		return left;
	}

	private parseArithExpr(): ExprNode {
		let left = this.parseTerm();

		while (this.check(PlusToken) || this.check(MinusToken)) {
			const op = this.advance();
			const right = this.parseTerm();
			left = new ArithNode(
				op instanceof PlusToken ? "+" : "-",
				left,
				right,
				{start: left.span.start, end: right.span.end}
			);
		}

		return left;
	}

	private parseTerm(): ExprNode {
		// Parenthesized expression
		if (this.match(LParenToken)) {
			const expr = this.parseExpression();
			this.expect(RParenToken, '")"');
			return expr;
		}

		// String literal
		if (this.check(StringToken)) {
			return this.parseStringLiteral();
		}

		// Number literal
		if (this.check(NumberToken)) {
			return this.parseNumberLiteral();
		}

		// Duration literal
		if (this.check(DurationToken)) {
			return this.parseDurationLiteral();
		}

		// Boolean literal
		if (this.check(BooleanToken)) {
			return this.parseBooleanLiteral();
		}

		// Null literal
		if (this.check(NullToken)) {
			return this.parseNullLiteral();
		}

		// Date literals
		if (this.check(DateLiteralToken)) {
			return this.parseDateExpr();
		}

		// Relative date literals
		if (this.isRelativeDate()) {
			return this.parseDateExpr();
		}

		// Function call or property access
		if (this.check(IdentifierToken)) {
			if (this.checkNext(LParenToken)) {
				return this.parseFunctionCall();
			}
			return this.parsePropertyAccess();
		}

		// Built-in property access ($file.name, $traversal.depth)
		if (this.check(BuiltinIdentifierToken)) {
			return this.parseBuiltinPropertyAccess();
		}

		// Handle aggregate functions that are keywords
		if (this.isAggregateKeyword() && this.checkNext(LParenToken)) {
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

	private parseStringLiteral(): StringNode {
		const token = this.advance();
		return new StringNode(token.value, token.span);
	}

	private parseNumberLiteral(): NumberNode {
		const token = this.advance();
		return new NumberNode(parseFloat(token.value), token.span);
	}

	private parseDurationLiteral(): DurationNode {
		const token = this.advance();
		const match = token.value.match(/^(\d+(?:\.\d+)?)([dwmy])$/);
		if (!match || !match[1] || !match[2]) {
			throw new ParseError(`Invalid duration: ${token.value}`, token.span);
		}
		return new DurationNode(
			parseFloat(match[1]),
			match[2] as DurationUnit,
			token.span
		);
	}

	private parseBooleanLiteral(): BooleanNode {
		const token = this.advance();
		return new BooleanNode(token.value.toLowerCase() === "true", token.span);
	}

	private parseNullLiteral(): NullNode {
		const token = this.advance();
		return new NullNode(token.span);
	}

	private parseDateExpr(): DateExprNode {
		const start = this.current().span.start;

		if (this.check(DateLiteralToken)) {
			const token = this.advance();
			const date = new Date(token.value);
			if (isNaN(date.getTime())) {
				throw new ParseError(`Invalid date: ${token.value}`, token.span);
			}

			const base = {type: "dateLiteral" as const, value: date, span: token.span};
			const offset = this.parseDateOffset();
			return new DateExprNode(base, {start, end: this.previous().span.end}, offset);
		}

		if (this.isRelativeDate()) {
			const token = this.advance();
			const kind = this.tokenToRelativeDateKind(token);
			const base = {type: "relativeDate" as const, kind, span: token.span};
			const offset = this.parseDateOffset();
			return new DateExprNode(base, {start, end: this.previous().span.end}, offset);
		}

		throw new ParseError("Expected date expression", this.current().span);
	}

	private parseDateOffset(): {op: "+" | "-"; value: number; unit: DurationUnit} | undefined {
		if (this.check(PlusToken) || this.check(MinusToken)) {
			const op = this.advance();
			const duration = this.parseDurationLiteral();
			return {
				op: op instanceof PlusToken ? "+" : "-",
				value: duration.value,
				unit: duration.unit,
			};
		}
		return undefined;
	}

	// =========================================================================
	// Property and Function Parsing
	// =========================================================================

	private parsePropertyAccess(): PropertyNode {
		const start = this.current().span.start;
		const path: string[] = [];

		const first = this.expect(IdentifierToken, "property name");
		path.push(first.value);

		while (this.match(DotToken)) {
			const part = this.expect(IdentifierToken, "property name");
			path.push(part.value);
		}

		return new PropertyNode(path, {start, end: this.previous().span.end}, false);
	}

	private parseBuiltinPropertyAccess(): PropertyNode {
		const start = this.current().span.start;
		const path: string[] = [];

		const first = this.expect(BuiltinIdentifierToken, "built-in property name");
		// Remove the $ prefix from the value
		path.push(first.value.slice(1));

		while (this.match(DotToken)) {
			const part = this.expect(IdentifierToken, "property name");
			path.push(part.value);
		}

		return new PropertyNode(path, {start, end: this.previous().span.end}, true);
	}

	private parseFunctionCall(): ExprNode {
		const name = this.current().value;

		// Check if this is an aggregate function
		if (this.isAggregate(name)) {
			return this.parseAggregateExpr(name as AggregateFunc);
		}

		// Regular function call
		const start = this.current().span.start;
		const nameToken = this.check(AllToken) ? this.advance() : this.expect(IdentifierToken, "function name");

		this.expect(LParenToken, '"("');

		const args: ExprNode[] = [];
		if (!this.check(RParenToken)) {
			args.push(this.parseExpression());
			while (this.match(CommaToken)) {
				args.push(this.parseExpression());
			}
		}

		this.expect(RParenToken, '")"');

		return new CallNode(nameToken.value, args, {start, end: this.previous().span.end});
	}

	// =========================================================================
	// Aggregate Parsing
	// =========================================================================

	private isAggregate(name: string): boolean {
		return ["count", "sum", "avg", "min", "max", "any", "all"].includes(name.toLowerCase());
	}

	private isAggregateKeyword(): boolean {
		return this.check(AllToken);
	}

	private parseAggregateExpr(func: AggregateFunc): AggregateNode {
		const start = this.current().span.start;
		this.advance(); // consume function name
		this.expect(LParenToken, '"("');

		let source: AggregateSource;
		if (this.match(FromToken)) {
			source = this.parseInlineFrom();
		} else if (this.check(GroupToken)) {
			source = this.parseGroupRefExpr();
		} else if (this.check(IdentifierToken)) {
			source = this.parseBareIdentifier();
		} else {
			throw new ParseError(
				'Expected "from", "group()", or identifier in aggregate function',
				this.current().span,
				["from", "group()", "identifier"]
			);
		}

		let property: PropertyNode | undefined;
		let condition: ExprNode | undefined;

		if (this.match(CommaToken)) {
			if (func === "any" || func === "all") {
				condition = this.parseExpression();
			} else if (func === "sum" || func === "avg" || func === "min" || func === "max") {
				property = this.parsePropertyAccess();
			}
		}

		this.expect(RParenToken, '")"');

		return new AggregateNode(
			func,
			source,
			{start, end: this.previous().span.end},
			property,
			condition
		);
	}

	private parseGroupRefExpr(): GroupRefSource {
		const start = this.current().span.start;
		this.expect(GroupToken, '"group"');
		this.expect(LParenToken, '"("');

		let name: string;
		if (this.check(IdentifierToken)) {
			name = this.advance().value;
		} else if (this.check(StringToken)) {
			name = this.advance().value;
		} else {
			throw new ParseError(
				'Expected group name (identifier or string)',
				this.current().span,
				["identifier", "string"]
			);
		}

		this.expect(RParenToken, '")"');

		return {
			type: "groupRef",
			name,
			span: {start, end: this.previous().span.end},
		};
	}

	private parseInlineFrom(): InlineFromSource {
		const start = this.previous().span.start;

		const relations: RelationSpecNode[] = [];
		relations.push(this.parseRelationSpec());

		while (this.check(CommaToken) && this.looksLikeMoreRelations()) {
			this.advance();
			relations.push(this.parseRelationSpec());
		}

		return {
			type: "inlineFrom",
			relations: relations.map((r) => ({
				name: r.name,
				depth: r.depth,
				extend: r.extend,
				flatten: r.flatten,
				span: r.span,
			})),
			span: {start, end: this.previous().span.end},
		};
	}

	private looksLikeMoreRelations(): boolean {
		const savedPos = this.pos;
		this.pos++;

		if (!this.check(IdentifierToken)) {
			this.pos = savedPos;
			return false;
		}

		this.pos++;
		const hasRelationModifier = this.check(DepthToken) || this.check(ExtendToken);
		this.pos = savedPos;
		return hasRelationModifier;
	}

	private parseBareIdentifier(): BareIdentifierSource {
		const token = this.expect(IdentifierToken, "group or relation name");
		return {
			type: "bareIdentifier",
			name: token.value,
			span: token.span,
		};
	}

	// =========================================================================
	// Helper Methods
	// =========================================================================

	private matchCompareOp(): TokenNode | null {
		const opClasses = [
			EqToken, NotEqToken, LtToken, GtToken, LtEqToken, GtEqToken,
			EqNullToken, NotEqNullToken,
		];
		for (const OpClass of opClasses) {
			if (this.check(OpClass)) {
				return this.advance();
			}
		}
		return null;
	}

	private tokenToCompareOp(token: TokenNode): CompareOp {
		if (token instanceof EqToken) return "=";
		if (token instanceof NotEqToken) return "!=";
		if (token instanceof LtToken) return "<";
		if (token instanceof GtToken) return ">";
		if (token instanceof LtEqToken) return "<=";
		if (token instanceof GtEqToken) return ">=";
		if (token instanceof EqNullToken) return "=?";
		if (token instanceof NotEqNullToken) return "!=?";
		return "=";
	}

	private tokenToRelativeDateKind(token: TokenNode): RelativeDateKind {
		if (token instanceof TodayToken) return "today";
		if (token instanceof YesterdayToken) return "yesterday";
		if (token instanceof TomorrowToken) return "tomorrow";
		if (token instanceof StartOfWeekToken) return "startOfWeek";
		if (token instanceof EndOfWeekToken) return "endOfWeek";
		return "today";
	}

	private isRelativeDate(): boolean {
		return (
			this.check(TodayToken) ||
			this.check(YesterdayToken) ||
			this.check(TomorrowToken) ||
			this.check(StartOfWeekToken) ||
			this.check(EndOfWeekToken)
		);
	}

	private current(): TokenNode {
		return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1]!;
	}

	private previous(): TokenNode {
		return this.tokens[this.pos - 1] ?? this.tokens[0]!;
	}

	private check<T extends typeof TokenNode>(TokenClass: T): boolean {
		return this.current() instanceof TokenClass;
	}

	private checkNext<T extends typeof TokenNode>(TokenClass: T): boolean {
		const next = this.tokens[this.pos + 1];
		return next instanceof TokenClass;
	}

	private match<T extends typeof TokenNode>(TokenClass: T): boolean {
		if (this.check(TokenClass)) {
			this.advance();
			return true;
		}
		return false;
	}

	private advance(): TokenNode {
		if (!this.isAtEnd()) {
			this.pos++;
		}
		return this.previous();
	}

	private isAtEnd(): boolean {
		return this.current() instanceof EOFToken;
	}

	private expect<T extends typeof TokenNode>(TokenClass: T, expected: string): TokenNode {
		if (this.check(TokenClass)) {
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
 * Parse a TQL query string into a QueryNode
 */
export function parse(input: string): QueryNode {
	const tokens = tokenize(input);
	const parser = new Parser(tokens);
	return parser.parse();
}

// Re-export for convenience
export {LexerError};
