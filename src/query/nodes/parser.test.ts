/**
 * Tests for the TQL Parser using Lezer + tree converter
 */

import {describe, it, expect} from "vitest";
import {parse, ParseError} from "./parser";
import {QueryNode, FromNode, WhereNode} from "./clauses";
import {OrExprNode, AndExprNode, CompareExprNode, PropertyNode} from "./expressions";
import {ExistsFunction} from "./functions/existence";
import {StringNode, NumberNode, BooleanNode, NullNode} from "./literals";
import {DateExprNode} from "./expressions";

describe("TQL Parser", () => {
	describe("Basic query parsing", () => {
		it("should parse minimal query", () => {
			const query = parse('group "Test" from up');
			expect(query).toBeInstanceOf(QueryNode);
			expect(query.group).toBe("Test");
			expect(query.from).toBeInstanceOf(FromNode);
			expect(query.from.chains.length).toBe(1);
			expect(query.from.chains[0]?.first.name).toBe("up");
		});

		it("should parse query with depth", () => {
			const query = parse('group "Test" from down :depth 3');
			expect(query.from.chains[0]?.first.depth).toBe(3);
		});

		it("should parse query with default unlimited depth", () => {
			const query = parse('group "Test" from up');
			expect(query.from.chains[0]?.first.depth).toBe("unlimited");
		});

		it("should parse multiple relations", () => {
			const query = parse('group "Test" from up, down');
			expect(query.from.chains.length).toBe(2);
			expect(query.from.chains[0]?.first.name).toBe("up");
			expect(query.from.chains[1]?.first.name).toBe("down");
		});
	});

	describe("WHERE clause parsing", () => {
		it("should parse simple comparison", () => {
			const query = parse('group "Test" from up where status = "active"');
			expect(query.where).toBeInstanceOf(WhereNode);
			expect(query.where!.expression).toBeInstanceOf(CompareExprNode);
			const compare = query.where!.expression as CompareExprNode;
			expect(compare.op).toBe("=");
			expect(compare.left).toBeInstanceOf(PropertyNode);
			expect(compare.right).toBeInstanceOf(StringNode);
		});

		it("should parse logical AND", () => {
			const query = parse('group "Test" from up where a = 1 and b = 2');
			expect(query.where).toBeInstanceOf(WhereNode);
			expect(query.where!.expression).toBeInstanceOf(AndExprNode);
		});

		it("should parse logical OR", () => {
			const query = parse('group "Test" from up where a = 1 or b = 2');
			expect(query.where).toBeInstanceOf(WhereNode);
			expect(query.where!.expression).toBeInstanceOf(OrExprNode);
		});

		it("should parse function calls", () => {
			const query = parse('group "Test" from up where exists(priority)');
			expect(query.where).toBeInstanceOf(WhereNode);
			expect(query.where!.expression).toBeInstanceOf(ExistsFunction);
			const func = query.where!.expression as ExistsFunction;
			expect(func.args.length).toBe(1);
		});
	});

	describe("Literal parsing", () => {
		it("should parse string literals", () => {
			const query = parse('group "Test" from up where name = "value"');
			const compare = query.where!.expression as CompareExprNode;
			expect(compare.right).toBeInstanceOf(StringNode);
			expect((compare.right as StringNode).value).toBe("value");
		});

		it("should parse number literals", () => {
			const query = parse('group "Test" from up where priority = 5');
			const compare = query.where!.expression as CompareExprNode;
			expect(compare.right).toBeInstanceOf(NumberNode);
			expect((compare.right as NumberNode).value).toBe(5);
		});

		it("should parse boolean literals", () => {
			const query = parse('group "Test" from up where active = true');
			const compare = query.where!.expression as CompareExprNode;
			expect(compare.right).toBeInstanceOf(BooleanNode);
			expect((compare.right as BooleanNode).value).toBe(true);
		});

		it("should parse null literal", () => {
			const query = parse('group "Test" from up where status = null');
			const compare = query.where!.expression as CompareExprNode;
			expect(compare.right).toBeInstanceOf(NullNode);
		});

		it("should parse relative date literals", () => {
			const query = parse('group "Test" from up where date = today');
			const compare = query.where!.expression as CompareExprNode;
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
			// The parser creates an ArithExprNode for today - 7d
			expect(query.where).toBeDefined();
		});
	});

	describe("Sort and display clauses", () => {
		it("should parse sort property", () => {
			const query = parse('group "Test" from up sort date :desc');
			expect(query.sort).toBeDefined();
			expect(query.sort?.keys.length).toBe(1);
			expect(query.sort?.keys[0]?.direction).toBe("desc");
		});

		it("should parse sort :chain", () => {
			const query = parse('group "Test" from up sort :chain');
			expect(query.sort?.keys[0]?.key).toBe("chain");
		});
		
		it("should parse sort with builtin property", () => {
			const query = parse('group "Test" from up sort $file.name :desc');
			expect(query.sort?.keys[0]?.key).toBeInstanceOf(PropertyNode);
			const prop = query.sort?.keys[0]?.key as PropertyNode;
			expect(prop.isBuiltin).toBe(true);
			expect(prop.path).toEqual(["file", "name"]);
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
		
		it("should parse display with builtin properties", () => {
			const query = parse('group "Test" from up display $file.name, $file.path');
			expect(query.display?.properties.length).toBe(2);
			expect(query.display?.properties[0]?.isBuiltin).toBe(true);
			expect(query.display?.properties[0]?.path).toEqual(["file", "name"]);
		});
	});

	describe("Chaining", () => {
		it("should parse relation chain", () => {
			const query = parse('group "Test" from up >> next');
			expect(query.from.chains.length).toBe(1);
			expect(query.from.chains[0]?.chain.length).toBe(1);
			expect(query.from.chains[0]?.chain[0]?.type).toBe("relation");
			if (query.from.chains[0]?.chain[0]?.type === "relation") {
				expect(query.from.chains[0].chain[0].spec.name).toBe("next");
			}
		});
		
		it("should parse group reference chain", () => {
			const query = parse('group "Test" from up >> @"Children"');
			expect(query.from.chains[0]?.chain.length).toBe(1);
			expect(query.from.chains[0]?.chain[0]?.type).toBe("group");
			if (query.from.chains[0]?.chain[0]?.type === "group") {
				expect(query.from.chains[0].chain[0].name).toBe("Children");
			}
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
