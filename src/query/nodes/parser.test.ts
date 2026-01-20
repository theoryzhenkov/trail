/**
 * Tests for the new TQL Parser that creates node class instances
 */

import {describe, it, expect} from "vitest";
import {parse, ParseError} from "./parser";
import {tokenize, LexerError} from "./lexer";
import {QueryNode, FromNode} from "./clauses";
import {LogicalNode, CompareNode, PropertyNode, CallNode} from "./expressions";
import {StringNode, NumberNode, BooleanNode, NullNode, DurationNode} from "./literals";
import {DateExprNode} from "./expressions";
import {
	GroupToken, FromToken, WhereToken, WhenToken, StringToken, NumberToken,
	IdentifierToken, EOFToken,
} from "./tokens";

describe("TQL Lexer", () => {
	describe("Basic tokenization", () => {
		it("should tokenize keywords", () => {
			const tokens = tokenize("group from where when");
			expect(tokens[0]).toBeInstanceOf(GroupToken);
			expect(tokens[1]).toBeInstanceOf(FromToken);
			expect(tokens[2]).toBeInstanceOf(WhereToken);
			expect(tokens[3]).toBeInstanceOf(WhenToken);
			expect(tokens[4]).toBeInstanceOf(EOFToken);
		});

		it("should tokenize string literals", () => {
			const tokens = tokenize('"hello world"');
			expect(tokens[0]).toBeInstanceOf(StringToken);
			expect(tokens[0]?.value).toBe("hello world");
		});

		it("should tokenize number literals", () => {
			const tokens = tokenize("42 3.14");
			expect(tokens[0]).toBeInstanceOf(NumberToken);
			expect(tokens[0]?.value).toBe("42");
			expect(tokens[1]).toBeInstanceOf(NumberToken);
			expect(tokens[1]?.value).toBe("3.14");
		});

		it("should tokenize identifiers", () => {
			const tokens = tokenize("myProperty file.name");
			expect(tokens[0]).toBeInstanceOf(IdentifierToken);
			expect(tokens[0]?.value).toBe("myProperty");
		});

		it("should handle escape sequences in strings", () => {
			const tokens = tokenize('"line1\\nline2"');
			expect(tokens[0]).toBeInstanceOf(StringToken);
			expect(tokens[0]?.value).toBe("line1\nline2");
		});

		it("should throw on unterminated strings", () => {
			expect(() => tokenize('"unterminated')).toThrow(LexerError);
		});
	});

	describe("Operator tokenization", () => {
		it("should tokenize comparison operators", () => {
			const tokens = tokenize("= != < > <= >= =? !=?");
			expect(tokens.length).toBe(9); // 8 operators + EOF
		});

		it("should tokenize arithmetic operators", () => {
			const tokens = tokenize("+ -");
			expect(tokens.length).toBe(3); // 2 operators + EOF
		});

		it("should tokenize range operator", () => {
			const tokens = tokenize("..");
			expect(tokens.length).toBe(2); // 1 operator + EOF
		});
	});
});

describe("TQL Parser", () => {
	describe("Basic query parsing", () => {
		it("should parse minimal query", () => {
			const query = parse('group "Test" from up');
			expect(query).toBeInstanceOf(QueryNode);
			expect(query.group).toBe("Test");
			expect(query.from).toBeInstanceOf(FromNode);
			expect(query.from.relations.length).toBe(1);
			expect(query.from.relations[0]?.name).toBe("up");
		});

		it("should parse query with depth", () => {
			const query = parse('group "Test" from down depth 3');
			expect(query.from.relations[0]?.depth).toBe(3);
		});

		it("should parse query with unlimited depth", () => {
			const query = parse('group "Test" from up depth unlimited');
			expect(query.from.relations[0]?.depth).toBe("unlimited");
		});

		it("should parse multiple relations", () => {
			const query = parse('group "Test" from up, down');
			expect(query.from.relations.length).toBe(2);
			expect(query.from.relations[0]?.name).toBe("up");
			expect(query.from.relations[1]?.name).toBe("down");
		});
	});

	describe("WHERE clause parsing", () => {
		it("should parse simple comparison", () => {
			const query = parse('group "Test" from up where status = "active"');
			expect(query.where).toBeInstanceOf(CompareNode);
			const compare = query.where as CompareNode;
			expect(compare.op).toBe("=");
			expect(compare.left).toBeInstanceOf(PropertyNode);
			expect(compare.right).toBeInstanceOf(StringNode);
		});

		it("should parse logical AND", () => {
			const query = parse('group "Test" from up where a = 1 and b = 2');
			expect(query.where).toBeInstanceOf(LogicalNode);
			const logical = query.where as LogicalNode;
			expect(logical.op).toBe("and");
		});

		it("should parse logical OR", () => {
			const query = parse('group "Test" from up where a = 1 or b = 2');
			expect(query.where).toBeInstanceOf(LogicalNode);
			const logical = query.where as LogicalNode;
			expect(logical.op).toBe("or");
		});

		it("should parse function calls", () => {
			const query = parse('group "Test" from up where exists(priority)');
			expect(query.where).toBeInstanceOf(CallNode);
			const call = query.where as CallNode;
			expect(call.name).toBe("exists");
			expect(call.args.length).toBe(1);
		});
	});

	describe("Literal parsing", () => {
		it("should parse string literals", () => {
			const query = parse('group "Test" from up where name = "value"');
			const compare = query.where as CompareNode;
			expect(compare.right).toBeInstanceOf(StringNode);
			expect((compare.right as StringNode).value).toBe("value");
		});

		it("should parse number literals", () => {
			const query = parse('group "Test" from up where priority = 5');
			const compare = query.where as CompareNode;
			expect(compare.right).toBeInstanceOf(NumberNode);
			expect((compare.right as NumberNode).value).toBe(5);
		});

		it("should parse boolean literals", () => {
			const query = parse('group "Test" from up where active = true');
			const compare = query.where as CompareNode;
			expect(compare.right).toBeInstanceOf(BooleanNode);
			expect((compare.right as BooleanNode).value).toBe(true);
		});

		it("should parse null literal", () => {
			const query = parse('group "Test" from up where status = null');
			const compare = query.where as CompareNode;
			expect(compare.right).toBeInstanceOf(NullNode);
		});

		it("should parse relative date literals", () => {
			const query = parse('group "Test" from up where date = today');
			const compare = query.where as CompareNode;
			// Relative dates are wrapped in DateExprNode
			expect(compare.right).toBeInstanceOf(DateExprNode);
			const dateExpr = compare.right as DateExprNode;
			expect(dateExpr.base.type).toBe("relativeDate");
			if (dateExpr.base.type === "relativeDate") {
				expect(dateExpr.base.kind).toBe("today");
			}
		});

		it("should parse duration literals", () => {
			const query = parse('group "Test" from up where date > today - 7d');
			// The parser creates an ArithNode for today - 7d
			expect(query.where).toBeDefined();
		});
	});

	describe("Sort and display clauses", () => {
		it("should parse sort property", () => {
			const query = parse('group "Test" from up sort date desc');
			expect(query.sort).toBeDefined();
			expect(query.sort?.keys.length).toBe(1);
			expect(query.sort?.keys[0]?.direction).toBe("desc");
		});

		it("should parse sort $chain", () => {
			const query = parse('group "Test" from up sort $chain');
			expect(query.sort?.keys[0]?.key).toBe("chain");
		});

		it("should parse display all", () => {
			const query = parse('group "Test" from up display all');
			expect(query.display?.all).toBe(true);
		});

		it("should parse display specific properties", () => {
			const query = parse('group "Test" from up display status, priority');
			expect(query.display?.all).toBe(false);
			expect(query.display?.properties.length).toBe(2);
		});
	});

	describe("Error handling", () => {
		it("should throw ParseError for missing group", () => {
			expect(() => parse('from up')).toThrow(ParseError);
		});

		it("should throw ParseError for missing from clause", () => {
			expect(() => parse('group "Test"')).toThrow(ParseError);
		});

		it("should throw ParseError for invalid syntax", () => {
			expect(() => parse('group "Test" from up where ==')).toThrow(ParseError);
		});
	});
});
