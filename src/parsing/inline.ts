/**
 * Inline relation parsing from note content.
 *
 * Extended syntax supports:
 * - Prefix: rel::[[A]] (currentFile -> A, sets context)
 * - Suffix: [[A]]::rel (A -> currentFile if no continuation, else sets context)
 * - Triple: [[A]]::rel::[[B]] (A -> B, sets context)
 * - Fan-out: [[A]]::rel::[[B]]::[[C]] (A -> B, A -> C)
 * - Chain: [[A]]::rel::[[B]]::-::[[C]] (A -> B, B -> C)
 * - Context continuation: ::[[B]] (uses current context source)
 * - Context chain: ::-::[[B]] (chains from lastTarget)
 *
 * Context rules:
 * - Any pattern with a relation keyword sets new context
 * - Context persists until new relation keyword
 * - ::[[B]] and ::-::[[B]] use current context
 *
 * @see docs/syntax/inline.md
 */

import {ParsedRelation} from "../types";
import {dedupeRelations, extractLinkTarget, isValidRelationName, normalizeRelationName} from "./index";

/** Context state for tracking across the file */
interface ParserContext {
	source: string | undefined;  // undefined = currentFile (matches ParsedRelation)
	relation: string;
	lastTarget: string | undefined;  // undefined = currentFile (matches ParsedRelation)
}

/** A match with its position and type */
interface PatternMatch {
	type: "triple" | "prefix" | "suffix" | "continuation" | "chain";
	start: number;
	end: number;
	relation?: string;
	source?: string;
	target?: string;
}

// Pattern regexes - relation names must start with alphanumeric
const TRIPLE_REGEX = /\[\[([^\]]+)\]\]::\s*([a-z0-9][a-z0-9_-]*)\s*::\s*\[\[([^\]]+)\]\]/gi;
const PREFIX_REGEX = /([a-z0-9][a-z0-9_-]*)::\s*\[\[([^\]]+)\]\]/gi;
const SUFFIX_REGEX = /\[\[([^\]]+)\]\]::\s*([a-z0-9][a-z0-9_-]*)/gi;
const CONTINUATION_REGEX = /::\s*\[\[([^\]]+)\]\]/gi;
const CHAIN_REGEX = /::-::\s*\[\[([^\]]+)\]\]/gi;

export function parseInlineRelations(content: string, allowedRelations?: Set<string>): ParsedRelation[] {
	const relations: ParsedRelation[] = [];
	const matches: PatternMatch[] = [];
	
	// Collect all pattern matches
	collectTripleMatches(content, matches);
	collectPrefixMatches(content, matches);
	collectSuffixMatches(content, matches);
	collectChainMatches(content, matches);
	collectContinuationMatches(content, matches);
	
	// Sort by position
	matches.sort((a, b) => a.start - b.start);
	
	// Remove overlapping matches (prefer earlier, more specific ones)
	const filteredMatches = removeOverlaps(matches);
	
	// Process matches in order with context tracking
	let context: ParserContext | null = null;
	
	for (const match of filteredMatches) {
		const relation = match.relation ? normalizeRelationName(match.relation) : null;
		
		// Skip if relation is specified but not valid/allowed
		if (relation) {
			if (!isValidRelationName(relation)) continue;
			if (allowedRelations && !allowedRelations.has(relation)) continue;
		}
		
		switch (match.type) {
			case "triple": {
				// [[A]]::rel::[[B]] - creates A->B, sets context
				const source = match.source ? extractLinkTarget(match.source) : undefined;
				const target = match.target ? extractLinkTarget(match.target) : undefined;
				if (!source || !target || !relation) continue;
				
				relations.push({relation, target, source});
				context = {source, relation, lastTarget: target};
				break;
			}
			
			case "prefix": {
				// rel::[[A]] - creates currentFile->A, sets context
				const target = match.target ? extractLinkTarget(match.target) : undefined;
				if (!target || !relation) continue;
				
				relations.push({relation, target});
				context = {source: undefined, relation, lastTarget: target};
				break;
			}
			
			case "suffix": {
				// [[A]]::rel - creates A->currentFile, sets context
				// But if continuation follows, don't create edge to currentFile
				const source = match.source ? extractLinkTarget(match.source) : undefined;
				if (!source || !relation) continue;
				
				// Check if fan-out continuation follows this match
				// Only "continuation" (::[[X]]) counts, not "chain" (::-::[[X]]) which needs lastTarget
				const hasFollowingContinuation = filteredMatches.some(m => 
					m.start > match.end && 
					m.type === "continuation" &&
					!filteredMatches.some(between => 
						between.start > match.end && 
						between.start < m.start &&
						(between.type === "triple" || between.type === "prefix" || between.type === "suffix")
					)
				);
				
				if (!hasFollowingContinuation) {
					// No continuation, create edge A -> currentFile
					relations.push({relation, source});
				}
				
				// lastTarget = undefined because A -> currentFile, and currentFile is the target
				context = {source, relation, lastTarget: undefined};
				break;
			}
			
			case "continuation": {
				// ::[[B]] - uses context source -> B
				if (!context) continue;
				const target = match.target ? extractLinkTarget(match.target) : undefined;
				if (!target) continue;
				
				// source passes through directly (undefined = currentFile)
				relations.push({relation: context.relation, target, source: context.source});
				context.lastTarget = target;
				break;
			}
			
			case "chain": {
				// ::-::[[B]] - chains from lastTarget -> B
				// lastTarget undefined means currentFile - that's valid for chaining
				if (!context) continue;
				const target = match.target ? extractLinkTarget(match.target) : undefined;
				if (!target) continue;
				
				// lastTarget passes through directly (undefined = currentFile)
				relations.push({relation: context.relation, target, source: context.lastTarget});
				context.lastTarget = target;
				break;
			}
		}
	}
	
	return dedupeRelations(relations);
}

function collectTripleMatches(content: string, matches: PatternMatch[]): void {
	for (const match of content.matchAll(TRIPLE_REGEX)) {
		matches.push({
			type: "triple",
			start: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
			source: match[1],
			relation: match[2],
			target: match[3],
		});
	}
}

function collectPrefixMatches(content: string, matches: PatternMatch[]): void {
	for (const match of content.matchAll(PREFIX_REGEX)) {
		matches.push({
			type: "prefix",
			start: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
			relation: match[1],
			target: match[2],
		});
	}
}

function collectSuffixMatches(content: string, matches: PatternMatch[]): void {
	for (const match of content.matchAll(SUFFIX_REGEX)) {
		matches.push({
			type: "suffix",
			start: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
			source: match[1],
			relation: match[2],
		});
	}
}

function collectContinuationMatches(content: string, matches: PatternMatch[]): void {
	for (const match of content.matchAll(CONTINUATION_REGEX)) {
		matches.push({
			type: "continuation",
			start: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
			target: match[1],
		});
	}
}

function collectChainMatches(content: string, matches: PatternMatch[]): void {
	for (const match of content.matchAll(CHAIN_REGEX)) {
		matches.push({
			type: "chain",
			start: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
			target: match[1],
		});
	}
}

function removeOverlaps(matches: PatternMatch[]): PatternMatch[] {
	const result: PatternMatch[] = [];
	
	// Priority: triple > chain > continuation > prefix > suffix
	const priority: Record<PatternMatch["type"], number> = {
		triple: 5,
		chain: 4,
		continuation: 3,
		prefix: 2,
		suffix: 1,
	};
	
	// Sort by start position, then by priority (higher first)
	const sorted = [...matches].sort((a, b) => {
		if (a.start !== b.start) return a.start - b.start;
		return priority[b.type] - priority[a.type];
	});
	
	for (const match of sorted) {
		const overlaps = result.some(existing =>
			(match.start >= existing.start && match.start < existing.end) ||
			(match.end > existing.start && match.end <= existing.end) ||
			(match.start <= existing.start && match.end >= existing.end)
		);
		
		if (!overlaps) {
			result.push(match);
		}
	}
	
	// Re-sort by position for processing order
	return result.sort((a, b) => a.start - b.start);
}
