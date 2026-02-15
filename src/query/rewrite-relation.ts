import {normalizeRelationName} from "../relations";
import {parser} from "./codemirror/parser";

interface Replacement {
	from: number;
	to: number;
	text: string;
}

export function rewriteRelationInTqlQuery(query: string, oldName: string, newName: string): string {
	const oldNormalized = normalizeRelationName(oldName);
	const nextName = newName.trim();
	if (!query || !oldNormalized || !nextName) {
		return query;
	}

	const tree = parser.parse(query);
	const replacements: Replacement[] = [];
	let relationSpecDepth = 0;
	let hasParseError = false;

	tree.iterate({
		enter: (nodeRef) => {
			if (nodeRef.type.isError) {
				hasParseError = true;
				return;
			}
			if (nodeRef.name === "RelationSpec") {
				relationSpecDepth += 1;
				return;
			}
			if (relationSpecDepth > 0 && nodeRef.name === "Identifier") {
				const currentName = query.slice(nodeRef.from, nodeRef.to);
				if (normalizeRelationName(currentName) === oldNormalized) {
					replacements.push({from: nodeRef.from, to: nodeRef.to, text: nextName});
				}
			}
		},
		leave: (nodeRef) => {
			if (nodeRef.name === "RelationSpec") {
				relationSpecDepth = Math.max(0, relationSpecDepth - 1);
			}
		},
	});

	if (hasParseError || replacements.length === 0) {
		return query;
	}

	let rewritten = query;
	for (const replacement of [...replacements].sort((a, b) => b.from - a.from)) {
		rewritten =
			rewritten.slice(0, replacement.from) +
			replacement.text +
			rewritten.slice(replacement.to);
	}
	return rewritten;
}
