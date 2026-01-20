import {describe, it, expect} from "vitest";
import {migrateTqlSyntax, needsSyntaxMigration, migrateAllTqlSyntax} from "./syntax-migration";

describe("TQL Syntax Migration (3.x → 4.x)", () => {
	describe("depth N → :depth N", () => {
		it("should add colon prefix to depth", () => {
			const old = `group "Test" from up depth 3`;
			const expected = `group "Test" from up :depth 3`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should handle multiple relations with depth", () => {
			const old = `group "Test" from up depth 2, down depth 1`;
			const expected = `group "Test" from up :depth 2, down :depth 1`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should not double-prefix already migrated depth", () => {
			const old = `group "Test" from up :depth 3`;
			expect(migrateTqlSyntax(old)).toBe(old);
		});
	});

	describe("depth unlimited → remove", () => {
		it("should remove 'depth unlimited'", () => {
			const old = `group "Test" from up depth unlimited`;
			const expected = `group "Test" from up`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should be case insensitive", () => {
			const old = `group "Test" from up DEPTH UNLIMITED`;
			const expected = `group "Test" from up`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should preserve other depth values", () => {
			const old = `group "Test" from up depth 3`;
			const expected = `group "Test" from up :depth 3`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});
	});

	describe("flatten → :flatten", () => {
		it("should add colon prefix to flatten", () => {
			const old = `group "Test" from up flatten`;
			const expected = `group "Test" from up :flatten`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should handle flatten with depth", () => {
			const old = `group "Test" from up depth 3 flatten`;
			const expected = `group "Test" from up :depth 3 :flatten`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should handle flatten with number", () => {
			const old = `group "Test" from up flatten 2`;
			const expected = `group "Test" from up :flatten 2`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should not double-prefix already migrated flatten", () => {
			const old = `group "Test" from up :flatten`;
			expect(migrateTqlSyntax(old)).toBe(old);
		});
	});

	describe("sort by → sort", () => {
		it("should remove 'by' from 'sort by'", () => {
			const old = `group "Test" from up sort by date`;
			const expected = `group "Test" from up sort date`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should be case insensitive", () => {
			const old = `group "Test" from up SORT BY date`;
			const expected = `group "Test" from up sort date`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});
	});

	describe("asc/desc → :asc/:desc", () => {
		it("should add colon prefix to asc", () => {
			const old = `group "Test" from up sort date asc`;
			const expected = `group "Test" from up sort date :asc`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should add colon prefix to desc", () => {
			const old = `group "Test" from up sort date desc`;
			const expected = `group "Test" from up sort date :desc`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should handle multiple sort keys", () => {
			const old = `group "Test" from up sort by priority asc, date desc`;
			const expected = `group "Test" from up sort priority :asc, date :desc`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should be case insensitive", () => {
			const old = `group "Test" from up sort date DESC`;
			const expected = `group "Test" from up sort date :desc`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should not double-prefix already migrated asc/desc", () => {
			const old = `group "Test" from up sort date :desc`;
			expect(migrateTqlSyntax(old)).toBe(old);
		});
	});

	describe("chain → :chain", () => {
		it("should add colon prefix to chain in sort", () => {
			const old = `group "Test" from up sort chain`;
			const expected = `group "Test" from up sort :chain`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should handle chain with other sort keys", () => {
			const old = `group "Test" from up sort by chain, date desc`;
			const expected = `group "Test" from up sort :chain, date :desc`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should handle chain as secondary sort key", () => {
			const old = `group "Test" from up sort by priority asc, chain`;
			const expected = `group "Test" from up sort priority :asc, :chain`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should not double-prefix already migrated chain", () => {
			const old = `group "Test" from up sort :chain`;
			expect(migrateTqlSyntax(old)).toBe(old);
		});
	});

	describe("file.* → $file.*", () => {
		it("should add $ prefix to file.name", () => {
			const old = `group "Test" from up where file.name = "test"`;
			const expected = `group "Test" from up where $file.name = "test"`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should add $ prefix to file.path", () => {
			const old = `group "Test" from up display file.path`;
			const expected = `group "Test" from up display $file.path`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should add $ prefix to file.modified in sort", () => {
			const old = `group "Test" from up sort by file.modified desc`;
			const expected = `group "Test" from up sort $file.modified :desc`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should handle multiple file.* properties", () => {
			const old = `group "Test" from up display file.name, file.folder`;
			const expected = `group "Test" from up display $file.name, $file.folder`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should not double-prefix already migrated file.*", () => {
			const old = `group "Test" from up where $file.name = "test"`;
			expect(migrateTqlSyntax(old)).toBe(old);
		});

		it("should handle all file.* builtins", () => {
			const builtins = ["name", "path", "folder", "ext", "modified", "created", "size", "tags", "aliases"];
			for (const prop of builtins) {
				const old = `where file.${prop} = "x"`;
				const expected = `where $file.${prop} = "x"`;
				expect(migrateTqlSyntax(old)).toBe(expected);
			}
		});
	});

	describe("traversal.* → $traversal.*", () => {
		it("should add $ prefix to traversal.depth", () => {
			const old = `group "Test" from up where traversal.depth < 3`;
			const expected = `group "Test" from up where $traversal.depth < 3`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should add $ prefix to traversal.relation", () => {
			const old = `group "Test" from up where traversal.relation = "up"`;
			const expected = `group "Test" from up where $traversal.relation = "up"`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should not double-prefix already migrated traversal.*", () => {
			const old = `group "Test" from up where $traversal.depth < 3`;
			expect(migrateTqlSyntax(old)).toBe(old);
		});
	});

	describe('group("Name") → @"Name"', () => {
		it("should convert group reference in aggregates", () => {
			const old = `group "Test" from up where count(group("Children")) > 0`;
			const expected = `group "Test" from up where count(@"Children") > 0`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should convert group reference in chains", () => {
			const old = `group "Test" from up >> group("Siblings")`;
			const expected = `group "Test" from up >> @"Siblings"`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should handle spaces around parentheses", () => {
			const old = `count( group( "Children" ) )`;
			const expected = `count( @"Children" )`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should handle escaped quotes in group name", () => {
			const old = `group("My \\"Group\\"")`;
			const expected = `@"My \\"Group\\""`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should not change the group clause keyword", () => {
			const old = `group "Test" from up`;
			expect(migrateTqlSyntax(old)).toBe(old);
		});

		it("should not change already migrated @ syntax", () => {
			const old = `group "Test" from up >> @"Children"`;
			expect(migrateTqlSyntax(old)).toBe(old);
		});
	});

	describe("combined migrations", () => {
		it("should handle all migrations together", () => {
			const old = `group "Test"
from up depth unlimited
where file.name = "test" and traversal.depth < 5
sort by chain, file.modified desc
display file.name, status`;
			const expected = `group "Test"
from up
where $file.name = "test" and $traversal.depth < 5
sort :chain, $file.modified :desc
display $file.name, status`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should handle depth + flatten migration", () => {
			const old = `group "Test" from down depth 5 flatten`;
			const expected = `group "Test" from down :depth 5 :flatten`;
			expect(migrateTqlSyntax(old)).toBe(expected);
		});

		it("should not modify already-migrated queries", () => {
			const modern = `group "Test"
from up
where $file.name = "test"
sort :chain, date :desc`;
			expect(migrateTqlSyntax(modern)).toBe(modern);
		});

		it("should migrate old default groups", () => {
			// The old 3.x default groups
			const oldAncestors = `group "Ancestors"
from up depth unlimited`;
			const expectedAncestors = `group "Ancestors"
from up`;
			expect(migrateTqlSyntax(oldAncestors)).toBe(expectedAncestors);

			const oldSiblings = `group "Siblings"
from next depth 1, prev depth 1`;
			const expectedSiblings = `group "Siblings"
from next :depth 1, prev :depth 1`;
			expect(migrateTqlSyntax(oldSiblings)).toBe(expectedSiblings);
		});
	});

	describe("needsSyntaxMigration", () => {
		it("should detect 'depth N' without colon", () => {
			expect(needsSyntaxMigration(`from up depth 3`)).toBe(true);
		});

		it("should detect 'depth unlimited'", () => {
			expect(needsSyntaxMigration(`depth unlimited`)).toBe(true);
		});

		it("should detect 'flatten' without colon", () => {
			expect(needsSyntaxMigration(`from up flatten`)).toBe(true);
		});

		it("should detect 'sort by'", () => {
			expect(needsSyntaxMigration(`sort by date`)).toBe(true);
		});

		it("should detect unprefixed asc/desc in sort", () => {
			expect(needsSyntaxMigration(`sort date desc`)).toBe(true);
			expect(needsSyntaxMigration(`sort date asc`)).toBe(true);
		});

		it("should detect unprefixed chain in sort", () => {
			expect(needsSyntaxMigration(`sort chain`)).toBe(true);
		});

		it("should detect unprefixed file.*", () => {
			expect(needsSyntaxMigration(`file.name`)).toBe(true);
		});

		it("should detect unprefixed traversal.*", () => {
			expect(needsSyntaxMigration(`traversal.depth`)).toBe(true);
		});

		it('should detect group("Name") syntax', () => {
			expect(needsSyntaxMigration(`count(group("Children"))`)).toBe(true);
		});

		it("should return false for modern syntax", () => {
			expect(needsSyntaxMigration(`from up :depth 3 sort :chain, $file.name :desc`)).toBe(false);
		});

		it("should return false for already migrated groups", () => {
			expect(needsSyntaxMigration(`group "Ancestors"
from up`)).toBe(false);
		});
	});

	describe("migrateAllTqlSyntax", () => {
		it("should migrate multiple groups", () => {
			const groups = [
				{query: `group "A" from up sort by date desc`, enabled: true},
				{query: `group "B" from down depth 2 where file.name = "x"`, enabled: true},
				{query: `group "C" from up`, enabled: false}, // already modern
			];

			const result = migrateAllTqlSyntax(groups);

			expect(result.migrated).toBe(true);
			expect(result.count).toBe(2);
			expect(groups[0]!.query).toBe(`group "A" from up sort date :desc`);
			expect(groups[1]!.query).toBe(`group "B" from down :depth 2 where $file.name = "x"`);
			expect(groups[2]!.query).toBe(`group "C" from up`);
		});

		it("should return migrated=false when nothing to migrate", () => {
			const groups = [
				{query: `group "A" from up sort :chain`, enabled: true},
			];

			const result = migrateAllTqlSyntax(groups);

			expect(result.migrated).toBe(false);
			expect(result.count).toBe(0);
		});
	});
});
