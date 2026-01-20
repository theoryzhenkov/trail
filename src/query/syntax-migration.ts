/**
 * TQL Syntax Migration - Transform old TQL syntax (3.x) to new syntax (4.x)
 *
 * Breaking changes in 4.0.0:
 * 1. `depth N` → `:depth N` (colon prefix for modifiers)
 * 2. `depth unlimited` → remove (unlimited is default)
 * 3. `flatten` → `:flatten` (colon prefix)
 * 4. `sort by X` → `sort X` (remove "by" keyword)
 * 5. `asc` → `:asc` (colon prefix for sort direction)
 * 6. `desc` → `:desc` (colon prefix for sort direction)
 * 7. `chain` → `:chain` (colon prefix in sort context)
 * 8. `file.name` → `$file.name` ($ prefix for builtins)
 * 9. `traversal.depth` → `$traversal.depth` ($ prefix for builtins)
 * 10. `group("Name")` → `@"Name"` (@ prefix for group references)
 */

/**
 * Migrate a single TQL query from 3.x to 4.x syntax
 */
export function migrateTqlSyntax(query: string): string {
	let result = query;

	// 1. Remove "depth unlimited" first (before converting depth N)
	// Match "depth unlimited" with optional surrounding whitespace
	result = result.replace(/\s+depth\s+unlimited\b/gi, "");

	// 2. Convert "depth N" → ":depth N" (but not if already has colon)
	// Match word boundary + "depth" + space + number, not preceded by ":"
	result = result.replace(/(?<!:)\bdepth\s+(\d+)/gi, ":depth $1");

	// 3. Convert "flatten" → ":flatten" (but not if already has colon)
	// Can have optional number after it
	result = result.replace(/(?<!:)\bflatten\b/gi, ":flatten");

	// 4. Remove "by" from "sort by" (case insensitive)
	result = result.replace(/\bsort\s+by\b/gi, "sort");

	// 5-7. Handle sort clause: convert asc/desc/chain to :asc/:desc/:chain
	result = migrateSortClause(result);

	// 8. Add $ prefix to file.* builtins (when not already prefixed)
	result = result.replace(/(?<!\$)\bfile\.(name|path|folder|ext|modified|created|size|tags|aliases)\b/g, "\\$file.$1");

	// 9. Add $ prefix to traversal.* builtins (when not already prefixed)
	result = result.replace(/(?<!\$)\btraversal\.(depth|relation)\b/g, "\\$traversal.$1");

	// 10. Convert group("Name") → @"Name"
	result = result.replace(/\bgroup\s*\(\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\)/g, '@"$1"');

	// Clean up any double spaces that might have been introduced
	result = result.replace(/  +/g, " ");

	// Clean up trailing spaces on lines
	result = result.replace(/ +$/gm, "");

	// Unescape the $ signs we escaped earlier
	result = result.replace(/\\(\$)/g, "$1");

	return result;
}

/**
 * Migrate sort clause: convert asc/desc/chain to :asc/:desc/:chain
 */
function migrateSortClause(query: string): string {
	// Find sort clauses and process them
	// Sort clause: "sort" followed by content until next clause keyword or end
	const sortPattern = /\bsort\s+([\s\S]*?)(?=\b(?:display|where|when|prune|group|from)\b|$)/gi;

	return query.replace(sortPattern, (match, sortContent: string) => {
		let content = sortContent;

		// Convert standalone "chain" to ":chain" (not if already prefixed)
		content = content.replace(/(?<!:)\bchain\b/g, ":chain");

		// Convert standalone "asc" to ":asc" (not if already prefixed)
		content = content.replace(/(?<!:)\basc\b/gi, ":asc");

		// Convert standalone "desc" to ":desc" (not if already prefixed)
		content = content.replace(/(?<!:)\bdesc\b/gi, ":desc");

		return `sort ${content}`;
	});
}

/**
 * Check if a query uses old 3.x syntax and needs migration
 */
export function needsSyntaxMigration(query: string): boolean {
	// Check for any of the old syntax patterns
	const oldPatterns = [
		/(?<!:)\bdepth\s+\d+/i, // "depth N" without colon
		/\bdepth\s+unlimited\b/i, // "depth unlimited"
		/(?<!:)\bflatten\b/i, // "flatten" without colon
		/\bsort\s+by\b/i, // "sort by"
		/\bsort\s+[^:]*(?<!:)\b(asc|desc)\b/i, // asc/desc without colon in sort
		/\bsort\s+[^:]*(?<!:)\bchain\b/i, // chain without colon in sort
		/(?<!\$)\bfile\.(name|path|folder|ext|modified|created|size|tags|aliases)\b/, // file.* without $
		/(?<!\$)\btraversal\.(depth|relation)\b/, // traversal.* without $
		/\bgroup\s*\(\s*"[^"]*"\s*\)/, // group("Name") syntax
	];

	return oldPatterns.some((pattern) => pattern.test(query));
}

/**
 * Migrate all TQL groups in place, returning whether any were migrated
 */
export function migrateAllTqlSyntax(
	groups: Array<{query: string; enabled?: boolean}>
): {migrated: boolean; count: number} {
	let count = 0;

	for (const group of groups) {
		if (needsSyntaxMigration(group.query)) {
			group.query = migrateTqlSyntax(group.query);
			count++;
		}
	}

	return {migrated: count > 0, count};
}
