/**
 * Shared helpers for syntax tree conversion.
 * Used by node classes that need grammar-level utilities in their fromSyntax methods.
 */

import type {SyntaxNode} from "@lezer/common";
import type {ConvertContext} from "../registry";
import {ParseError} from "../../errors";

/**
 * Find a single clause node within wrapper nodes.
 * Used by QueryNode and InlineQueryNode to extract clauses.
 */
export function getSingleClause(
	node: SyntaxNode,
	wrapperName: string,
	clauseName: string,
	displayName: string,
	required: boolean,
	ctx: ConvertContext
): SyntaxNode | null {
	const wrapperNodes = node.getChildren(wrapperName);
	const matches = wrapperNodes
		.map((wrapper) => wrapper.getChild(clauseName))
		.filter((match): match is SyntaxNode => match !== null);

	if (matches.length > 1) {
		throw new ParseError(`Duplicate ${displayName} clause`, ctx.span(node));
	}
	if (matches.length === 0) {
		if (required) {
			throw new ParseError(`Missing ${displayName} clause`, ctx.span(node));
		}
		return null;
	}
	return matches[0] ?? null;
}
