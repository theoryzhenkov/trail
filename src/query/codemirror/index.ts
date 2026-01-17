/**
 * TQL CodeMirror 6 Integration
 * 
 * Provides a complete TQL editor with syntax highlighting,
 * autocomplete, linting, and hover tooltips.
 */

import {EditorState, Extension} from "@codemirror/state";
import {EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection} from "@codemirror/view";
import {defaultKeymap, history, historyKeymap} from "@codemirror/commands";
import {closeBrackets, closeBracketsKeymap} from "@codemirror/autocomplete";
import {bracketMatching} from "@codemirror/language";

import {tql} from "./language";
import {tqlEditorTheme, tqlSyntaxHighlighting} from "./theme";
import {createTQLAutocomplete} from "./autocomplete";
import {createTQLLinter} from "./linter";
import {createTQLHover} from "./hover";

// Re-export for external use
export {tql, tqlLanguage} from "./language";
export {tqlEditorTheme, tqlSyntaxHighlighting} from "./theme";
export {createTQLAutocomplete, FUNCTION_DOCS, FILE_PROPERTIES, TRAVERSAL_PROPERTIES} from "./autocomplete";
export type {TQLAutocompleteConfig} from "./autocomplete";
export {createTQLLinter} from "./linter";
export {createTQLHover} from "./hover";

/**
 * Configuration for creating a TQL editor
 */
export interface TQLEditorConfig {
	/** Initial document content */
	doc?: string;
	/** Parent element to attach editor to */
	parent: HTMLElement;
	/** Callback when document changes */
	onChange?: (value: string) => void;
	/** Available relation names */
	getRelationNames: () => string[];
	/** Minimum editor height */
	minHeight?: string;
}

/**
 * Create a complete TQL editor with all features
 */
export function createTQLEditor(config: TQLEditorConfig): EditorView {
	const extensions: Extension[] = [
		// Basic editor features
		lineNumbers(),
		highlightActiveLine(),
		drawSelection(),
		history(),
		bracketMatching(),
		closeBrackets(),
		
		// Keymaps
		keymap.of([
			...defaultKeymap,
			...historyKeymap,
			...closeBracketsKeymap,
		]),
		
		// TQL language support
		tql(),
		tqlSyntaxHighlighting,
		tqlEditorTheme,
		
		// Autocomplete
		createTQLAutocomplete({
			getRelationNames: config.getRelationNames,
		}),
		
		// Linting
		createTQLLinter(),
		
		// Hover tooltips
		createTQLHover(),
		
		// Change listener
		EditorView.updateListener.of((update) => {
			if (update.docChanged && config.onChange) {
				config.onChange(update.state.doc.toString());
			}
		}),
	];
	
	// Add min height if specified
	if (config.minHeight) {
		extensions.push(EditorView.theme({
			".cm-content": {
				minHeight: config.minHeight,
			},
		}));
	}
	
	const state = EditorState.create({
		doc: config.doc ?? "",
		extensions,
	});
	
	const view = new EditorView({
		state,
		parent: config.parent,
	});
	
	return view;
}

/**
 * Update editor content programmatically
 */
export function setEditorContent(view: EditorView, content: string): void {
	view.dispatch({
		changes: {
			from: 0,
			to: view.state.doc.length,
			insert: content,
		},
	});
}

/**
 * Get current editor content
 */
export function getEditorContent(view: EditorView): string {
	return view.state.doc.toString();
}
