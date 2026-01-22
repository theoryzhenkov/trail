/**
 * Inline relation parsing from note content.
 *
 * Extended syntax supports:
 * - Prefix: rel::[[A]] (currentFile -> A)
 * - Suffix: [[A]]::rel (A -> currentFile, unless continuation found)
 * - Triple: [[A]]::rel::[[B]] (A -> B)
 *
 * @see docs/syntax/inline.md
 */

import {ParsedRelation} from "../types";
import {dedupeRelations, extractLinkTarget, isValidRelationName, normalizeRelationName} from "./index";

// Triple syntax: [[Source]]::relation::[[Target]]
const TRIPLE_REGEX = /\[\[([^\]]+)\]\]::\s*([a-z0-9_-]+)\s*::\s*\[\[([^\]]+)\]\]/gi;

// Prefix syntax: relation::[[Target]]
const PREFIX_REGEX = /([a-z0-9_-]+)::\s*\[\[([^\]]+)\]\]/gi;

// Suffix syntax: [[Source]]::relation (source -> currentFile)
const SUFFIX_REGEX = /\[\[([^\]]+)\]\]::\s*([a-z0-9_-]+)/gi;

export function parseInlineRelations(content: string, allowedRelations?: Set<string>): ParsedRelation[] {
	const relations: ParsedRelation[] = [];
	
	// Track matched positions to avoid double-matching
	const matchedRanges: Array<{start: number; end: number}> = [];
	
	function isOverlapping(start: number, end: number): boolean {
		return matchedRanges.some(range => 
			(start >= range.start && start < range.end) ||
			(end > range.start && end <= range.end) ||
			(start <= range.start && end >= range.end)
		);
	}

	// First pass: match triple syntax (most specific)
	for (const match of content.matchAll(TRIPLE_REGEX)) {
		const rawSource = match[1];
		const rawRelation = match[2];
		const rawTarget = match[3];
		const matchStart = match.index ?? 0;
		const matchEnd = matchStart + match[0].length;
		
		if (!rawSource || !rawRelation || !rawTarget) {
			continue;
		}
		const relation = normalizeRelationName(rawRelation);
		if (!isValidRelationName(relation)) {
			continue;
		}
		if (allowedRelations && !allowedRelations.has(relation)) {
			continue;
		}
		const source = extractLinkTarget(rawSource);
		const target = extractLinkTarget(rawTarget);
		if (source.length === 0 || target.length === 0) {
			continue;
		}
		
		relations.push({relation, target, source});
		matchedRanges.push({start: matchStart, end: matchEnd});
	}

	// Second pass: match prefix syntax (avoiding already matched)
	for (const match of content.matchAll(PREFIX_REGEX)) {
		const matchStart = match.index ?? 0;
		const matchEnd = matchStart + match[0].length;
		
		if (isOverlapping(matchStart, matchEnd)) {
			continue;
		}
		
		const rawRelation = match[1];
		const rawTarget = match[2];
		if (!rawRelation || !rawTarget) {
			continue;
		}
		const relation = normalizeRelationName(rawRelation);
		if (!isValidRelationName(relation)) {
			continue;
		}
		if (allowedRelations && !allowedRelations.has(relation)) {
			continue;
		}
		const target = extractLinkTarget(rawTarget);
		if (target.length === 0) {
			continue;
		}
		relations.push({relation, target});
		matchedRanges.push({start: matchStart, end: matchEnd});
	}

	// Third pass: match suffix syntax (avoiding already matched)
	// Suffix syntax: [[A]]::rel means A -> currentFile
	for (const match of content.matchAll(SUFFIX_REGEX)) {
		const matchStart = match.index ?? 0;
		const matchEnd = matchStart + match[0].length;
		
		if (isOverlapping(matchStart, matchEnd)) {
			continue;
		}
		
		const rawSource = match[1];
		const rawRelation = match[2];
		if (!rawRelation || !rawSource) {
			continue;
		}
		const relation = normalizeRelationName(rawRelation);
		if (!isValidRelationName(relation)) {
			continue;
		}
		if (allowedRelations && !allowedRelations.has(relation)) {
			continue;
		}
		const target = extractLinkTarget(rawSource);
		if (target.length === 0) {
			continue;
		}
		// For suffix syntax, the wiki link is the source, target is current file
		relations.push({relation, target, targetIsCurrentFile: true});
		matchedRanges.push({start: matchStart, end: matchEnd});
	}

	return dedupeRelations(relations);
}
