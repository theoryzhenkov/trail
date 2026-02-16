import { describe, expect, it } from "vitest";
import { rewriteRelationInTqlQuery } from "./rewrite-relation";

describe("rewriteRelationInTqlQuery", () => {
	it("rewrites relation names in from and chain relation specs", () => {
		const input = `group "Test" from up :depth 2 >> down where $traversal.relation = "up"`;
		const output = rewriteRelationInTqlQuery(input, "UP", "Parent");
		expect(output).toBe(
			`group "Test" from Parent :depth 2 >> down where $traversal.relation = "up"`,
		);
	});

	it("rewrites relation names in inline queries", () => {
		const input = `group "Test" from down where count(@(from up :depth 1)) > 0`;
		const output = rewriteRelationInTqlQuery(input, "up", "ancestor");
		expect(output).toBe(
			`group "Test" from down where count(@(from ancestor :depth 1)) > 0`,
		);
	});

	it("does not rewrite when query has parse errors", () => {
		const input = `group "Test" from up where ==`;
		const output = rewriteRelationInTqlQuery(input, "up", "parent");
		expect(output).toBe(input);
	});

	it("should rename relation but preserve label", () => {
		const input = `group "test" from up.author`;
		const output = rewriteRelationInTqlQuery(input, "up", "parent");
		expect(output).toBe(`group "test" from parent.author`);
	});

	it("should not rename the label part", () => {
		const input = `group "test" from up.up`;
		const output = rewriteRelationInTqlQuery(input, "up", "parent");
		expect(output).toBe(`group "test" from parent.up`);
	});
});
