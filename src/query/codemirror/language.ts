/**
 * TQL Language Definition for CodeMirror 6
 *
 * Provides syntax highlighting for TQL queries using a Lezer LR parser.
 *
 * NOTE: CM6's native highlighting (via styleTags + HighlightStyle) does NOT work
 * in Obsidian plugins due to module instance fragmentation. The @lezer/highlight
 * module used to create NodeTypes with styleTags is a different instance than
 * the one used by TreeHighlighter to read those props.
 *
 * Instead, we use a ViewPlugin that reads the Lezer syntax tree and applies
 * decorations based on node types, bypassing CM6's native highlighting system.
 */

import { LRLanguage, LanguageSupport, syntaxTree } from "@codemirror/language";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { parser } from "./parser";

/**
 * TQL language definition using the Lezer parser.
 */
export const tqlLanguage = LRLanguage.define({
	name: "tql",
	parser,
	languageData: {
		commentTokens: { line: "//" },
	},
});

/**
 * Decoration marks for different node types.
 * These CSS classes are styled in styles.css.
 */
const keywordMark = Decoration.mark({ class: "tql-keyword" });
const typeMark = Decoration.mark({ class: "tql-type" });
const logicMark = Decoration.mark({ class: "tql-logic" });
const stringMark = Decoration.mark({ class: "tql-string" });
const numberMark = Decoration.mark({ class: "tql-number" });
const atomMark = Decoration.mark({ class: "tql-atom" });
const operatorMark = Decoration.mark({ class: "tql-operator" });
const functionMark = Decoration.mark({ class: "tql-function" });
const propertyMark = Decoration.mark({ class: "tql-property" });
const variableMark = Decoration.mark({ class: "tql-variable" });
const punctuationMark = Decoration.mark({ class: "tql-punctuation" });
const commentMark = Decoration.mark({ class: "tql-comment" });
const builtinMark = Decoration.mark({ class: "tql-builtin" });

/**
 * Map node names to decoration marks.
 * Based on the grammar node names from parser.terms.ts
 */
const nodeToMark: Record<string, Decoration> = {
	// Keywords - clause starters
	group: keywordMark,
	from: keywordMark,
	prune: keywordMark,
	where: keywordMark,
	when: keywordMark,
	sort: keywordMark,
	display: keywordMark,

	// Keywords - modifiers
	depth: typeMark,
	extend: typeMark,
	flatten: typeMark,
	asc: typeMark,
	desc: typeMark,
	all: typeMark,

	// Logical operators
	and: logicMark,
	or: logicMark,
	not: logicMark,
	in: logicMark,

	// Literals
	String: stringMark,
	Number: numberMark,
	Duration: numberMark,
	Boolean: atomMark,
	Null: atomMark,
	DateLiteral: numberMark,

	// Date keywords
	today: atomMark,
	yesterday: atomMark,
	tomorrow: atomMark,
	startOfWeek: atomMark,
	endOfWeek: atomMark,

	// Identifiers
	BuiltinIdentifier: builtinMark,

	// Comments
	LineComment: commentMark,
};

/**
 * Node names for parent context detection
 */
const functionCallParents = new Set(["FunctionCall"]);
const propertyAccessParents = new Set(["PropertyAccess", "SortKey"]);
const relationNameParents = new Set(["RelationName"]);

/**
 * Build decorations from the Lezer syntax tree.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const tree = syntaxTree(view.state);

	for (const { from, to } of view.visibleRanges) {
		tree.iterate({
			from,
			to,
			enter(node: SyntaxNode) {
				const mark = getMarkForNode(node);
				if (mark) {
					builder.add(node.from, node.to, mark);
				}
			},
		});
	}

	return builder.finish();
}

/**
 * Determine the appropriate decoration mark for a syntax node.
 */
function getMarkForNode(node: SyntaxNode): Decoration | null {
	const name = node.name;

	// Direct node type mapping
	if (nodeToMark[name]) {
		return nodeToMark[name];
	}

	// Special handling for Identifier based on context
	if (name === "Identifier") {
		return getIdentifierMark(node);
	}

	// Operators
	if (isOperator(name)) {
		return operatorMark;
	}

	// Punctuation
	if (isPunctuation(name)) {
		return punctuationMark;
	}

	return null;
}

/**
 * Determine the mark for an Identifier based on its parent context.
 */
function getIdentifierMark(node: SyntaxNode): Decoration {
	const parent = node.parent;

	if (!parent) {
		return variableMark;
	}

	// Function name in function call
	if (functionCallParents.has(parent.name)) {
		// Check if this is the first child (the function name)
		const firstChild = parent.firstChild;
		if (firstChild && firstChild.from === node.from) {
			return functionMark;
		}
	}

	// Property access
	if (propertyAccessParents.has(parent.name)) {
		return propertyMark;
	}

	// Relation name in RelationName (inside RelationSpec)
	if (relationNameParents.has(parent.name)) {
		return variableMark;
	}

	// Default
	return variableMark;
}

/**
 * Check if a node name represents an operator
 */
function isOperator(name: string): boolean {
	return [
		"=",
		"!=",
		"<",
		">",
		"<=",
		">=",
		"=?",
		"!=?",
		"+",
		"-",
		"..",
		"!",
	].includes(name);
}

/**
 * Check if a node name represents punctuation
 */
function isPunctuation(name: string): boolean {
	return ["(", ")", ",", "."].includes(name);
}

/**
 * ViewPlugin for TQL syntax highlighting.
 * Reads the Lezer syntax tree and applies decorations based on node types.
 */
export const tqlHighlightPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);

/**
 * TQL language support with ViewPlugin-based highlighting.
 *
 * Uses manual decoration instead of CM6's native highlighting
 * because the native system doesn't work in Obsidian plugins.
 */
export function tql(): LanguageSupport {
	return new LanguageSupport(tqlLanguage, [tqlHighlightPlugin]);
}
