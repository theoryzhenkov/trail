/**
 * Documentation extraction from node classes
 * 
 * Provides utilities to extract documentation and highlighting info
 * from the static properties on node classes.
 */

import type {NodeDoc} from "./types";

// Import all token classes for their static documentation
import {
	GroupToken, FromToken, WhereToken, WhenToken, PruneToken, SortToken, DisplayToken,
	DepthToken, UnlimitedToken, ExtendToken, FlattenToken,
	AscToken, DescToken, AllToken,
	AndToken, OrToken, NotToken, InToken,
	TrueToken, FalseToken, NullToken,
	TodayToken, YesterdayToken, TomorrowToken, StartOfWeekToken, EndOfWeekToken,
} from "./tokens";

// Token class type
type TokenClass = {
	keyword?: string;
	documentation?: NodeDoc;
	highlighting?: string;
};

/**
 * Map of keyword to token class
 */
const TOKEN_CLASSES: Record<string, TokenClass> = {
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

/**
 * Get documentation for a keyword
 */
export function getKeywordDoc(keyword: string): NodeDoc | undefined {
	const cls = TOKEN_CLASSES[keyword.toLowerCase()];
	return cls?.documentation;
}

/**
 * Get highlighting category for a keyword
 */
export function getKeywordHighlighting(keyword: string): string | undefined {
	const cls = TOKEN_CLASSES[keyword.toLowerCase()];
	return cls?.highlighting;
}

/**
 * Get all keyword documentation as a record
 */
export function getAllKeywordDocs(): Record<string, NodeDoc> {
	const result: Record<string, NodeDoc> = {};
	for (const [keyword, cls] of Object.entries(TOKEN_CLASSES)) {
		if (cls.documentation) {
			result[keyword] = cls.documentation;
		}
	}
	return result;
}

/**
 * Check if a word is a keyword
 */
export function isKeyword(word: string): boolean {
	return word.toLowerCase() in TOKEN_CLASSES;
}

/**
 * Get all keywords
 */
export function getAllKeywords(): string[] {
	return Object.keys(TOKEN_CLASSES);
}

/**
 * Get keywords by highlighting category
 */
export function getKeywordsByHighlighting(category: string): string[] {
	return Object.entries(TOKEN_CLASSES)
		.filter(([, cls]) => cls.highlighting === category)
		.map(([keyword]) => keyword);
}

/**
 * Clause keywords (for highlighting)
 */
export function getClauseKeywords(): string[] {
	return getKeywordsByHighlighting("keyword");
}

/**
 * Modifier keywords (for highlighting)
 */
export function getModifierKeywords(): string[] {
	return getKeywordsByHighlighting("typeName");
}

/**
 * Operator keywords (for highlighting)
 */
export function getOperatorKeywords(): string[] {
	return getKeywordsByHighlighting("operatorKeyword");
}

/**
 * Literal keywords (for highlighting)
 */
export function getLiteralKeywords(): string[] {
	return getKeywordsByHighlighting("atom");
}
