/**
 * TQL Parser - Uses Lezer parser and converts to typed AST nodes
 *
 * This parser uses the Lezer LR parser for parsing and then converts
 * the generic syntax tree to typed node class instances.
 */

import {parser} from "../codemirror/parser";
import {convert} from "./tree-converter";
import type {QueryNode} from "./clauses";
import {Query} from "./query";
import {ParseError} from "../errors";
import type {Span} from "./types";

/**
 * Extract error information from a Lezer parse tree
 */
function extractParseError(source: string, tree: ReturnType<typeof parser.parse>): ParseError | null {
	let errorNode: {from: number; to: number} | null = null;

	tree.iterate({
		enter(node) {
			if (node.type.isError && !errorNode) {
				errorNode = {from: node.from, to: node.to};
			}
		}
	});

	if (errorNode === null) return null;

	// Type assertion needed because TS doesn't trust that the callback ran synchronously
	const error = errorNode as {from: number; to: number};
	const span: Span = {start: error.from, end: error.to};
	const errorText = source.slice(error.from, Math.min(error.to + 10, source.length));

	// Handle empty span at end of input
	if (error.from === error.to && error.from === source.length) {
		return new ParseError("Unexpected end of input", span);
	}

	return new ParseError(
		`Unexpected token: ${errorText.trim() || "end of input"}`,
		span
	);
}

/**
 * Parse a TQL query string into a Query
 */
export function parse(input: string): Query {
	const queryNode = parseToQueryNode(input);
	return queryNode.toQuery();
}

/**
 * Parse a TQL query string into a QueryNode (AST node).
 * Use `parse()` for the preferred Query class.
 */
export function parseToQueryNode(input: string): QueryNode {
	const tree = parser.parse(input);

	// Check for parse errors in the tree
	const error = extractParseError(input, tree);
	if (error) {
		throw error;
	}

	// Convert Lezer tree to typed AST
	return convert(tree, input);
}

// Re-export ParseError for convenience
export {ParseError};
