/**
 * TQL Editor Theme for CodeMirror 6
 * 
 * Integrates with Obsidian's CSS variables for consistent theming.
 */

import {EditorView} from "@codemirror/view";
import {HighlightStyle, syntaxHighlighting} from "@codemirror/language";
import {tags as t} from "@lezer/highlight";

/**
 * Base editor theme that integrates with Obsidian's styles
 */
export const tqlEditorTheme = EditorView.theme({
	"&": {
		fontSize: "var(--font-ui-small)",
		fontFamily: "var(--font-monospace)",
		backgroundColor: "var(--background-primary)",
		color: "var(--text-normal)",
		border: "1px solid var(--background-modifier-border)",
		borderRadius: "var(--radius-s)",
	},
	".cm-content": {
		padding: "var(--size-4-2)",
		caretColor: "var(--text-normal)",
		minHeight: "120px",
	},
	".cm-line": {
		padding: "0 var(--size-4-1)",
	},
	".cm-cursor": {
		borderLeftColor: "var(--text-normal)",
	},
	".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
		backgroundColor: "var(--text-selection)",
	},
	".cm-activeLine": {
		backgroundColor: "var(--background-secondary)",
	},
	".cm-gutters": {
		backgroundColor: "var(--background-secondary)",
		color: "var(--text-faint)",
		border: "none",
		borderRight: "1px solid var(--background-modifier-border)",
	},
	".cm-lineNumbers .cm-gutterElement": {
		padding: "0 var(--size-4-2)",
	},
	// Autocomplete panel
	".cm-tooltip": {
		backgroundColor: "var(--background-primary)",
		border: "1px solid var(--background-modifier-border)",
		borderRadius: "var(--radius-s)",
		boxShadow: "var(--shadow-s)",
	},
	".cm-tooltip-autocomplete": {
		"& > ul": {
			fontFamily: "var(--font-monospace)",
			fontSize: "var(--font-ui-small)",
		},
		"& > ul > li": {
			padding: "var(--size-4-1) var(--size-4-2)",
		},
		"& > ul > li[aria-selected]": {
			backgroundColor: "var(--background-modifier-hover)",
			color: "var(--text-normal)",
		},
	},
	".cm-completionLabel": {
		color: "var(--text-normal)",
	},
	".cm-completionDetail": {
		color: "var(--text-muted)",
		fontStyle: "italic",
		marginLeft: "var(--size-4-2)",
	},
	".cm-completionIcon": {
		marginRight: "var(--size-4-1)",
	},
	// Diagnostics
	".cm-diagnostic": {
		padding: "var(--size-4-1) var(--size-4-2)",
		marginLeft: "0",
	},
	".cm-diagnostic-error": {
		borderLeft: "3px solid var(--text-error)",
		backgroundColor: "rgba(var(--color-red-rgb), 0.1)",
	},
	".cm-diagnostic-warning": {
		borderLeft: "3px solid var(--text-warning)",
		backgroundColor: "rgba(var(--color-yellow-rgb), 0.1)",
	},
	".cm-lintRange-error": {
		backgroundImage: "none",
		textDecoration: "underline wavy var(--text-error)",
		textUnderlineOffset: "3px",
	},
	".cm-lintRange-warning": {
		backgroundImage: "none",
		textDecoration: "underline wavy var(--text-warning)",
		textUnderlineOffset: "3px",
	},
	// Hover tooltip
	".cm-tooltip-hover": {
		padding: "var(--size-4-2)",
		maxWidth: "400px",
	},
}, {dark: false});

/**
 * Syntax highlighting for TQL
 */
export const tqlHighlightStyle = HighlightStyle.define([
	// Keywords (clauses)
	{tag: t.keyword, color: "var(--text-accent)"},
	// Strings
	{tag: t.string, color: "var(--color-green)"},
	// Numbers and durations
	{tag: t.number, color: "var(--color-cyan)"},
	// Booleans and null
	{tag: t.atom, color: "var(--color-orange)"},
	// Operators
	{tag: t.operator, color: "var(--text-accent)"},
	// Functions
	{tag: t.function(t.variableName), color: "var(--color-yellow)"},
	// Property names
	{tag: t.propertyName, color: "var(--color-purple)"},
	// Variables (relation names, identifiers)
	{tag: t.variableName, color: "var(--text-normal)"},
	// Punctuation
	{tag: t.punctuation, color: "var(--text-muted)"},
	// Comments (if we add them later)
	{tag: t.comment, color: "var(--text-faint)", fontStyle: "italic"},
]);

/**
 * Combined syntax highlighting extension
 */
export const tqlSyntaxHighlighting = syntaxHighlighting(tqlHighlightStyle);
