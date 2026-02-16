import { normalizeRelationName } from "../relations";
import { parser } from "./codemirror/parser";

interface Replacement {
	from: number;
	to: number;
	text: string;
}

export function rewriteRelationInTqlQuery(
	query: string,
	oldName: string,
	newName: string,
): string {
	const oldNormalized = normalizeRelationName(oldName);
	const nextName = newName.trim();
	if (!query || !oldNormalized || !nextName) {
		return query;
	}

	const tree = parser.parse(query);
	const replacements: Replacement[] = [];
	let hasParseError = false;

	tree.iterate({
		enter(nodeRef) {
			if (nodeRef.type.isError) {
				hasParseError = true;
				return undefined;
			}
			// Handle RelationName node: only rewrite the first Identifier (relation name), not the label
			if (nodeRef.name === "RelationName") {
				const firstChild = nodeRef.node.getChild("Identifier");
				if (firstChild) {
					const currentName = query.slice(
						firstChild.from,
						firstChild.to,
					);
					if (normalizeRelationName(currentName) === oldNormalized) {
						replacements.push({
							from: firstChild.from,
							to: firstChild.to,
							text: nextName,
						});
					}
				}
				return false; // don't descend further
			}
			return undefined;
		},
	});

	if (hasParseError || replacements.length === 0) {
		return query;
	}

	let rewritten = query;
	for (const replacement of [...replacements].sort(
		(a, b) => b.from - a.from,
	)) {
		rewritten =
			rewritten.slice(0, replacement.from) +
			replacement.text +
			rewritten.slice(replacement.to);
	}
	return rewritten;
}
