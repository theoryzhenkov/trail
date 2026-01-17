/**
 * TQL Linter for CodeMirror 6
 * 
 * Provides inline error markers using the TQL parser.
 */

import {Diagnostic, linter} from "@codemirror/lint";
import {EditorView} from "@codemirror/view";
import {parse} from "../parser";
import {ParseError} from "../errors";

/**
 * Create TQL linter that shows parse errors inline
 */
export function createTQLLinter() {
	return linter((view: EditorView): Diagnostic[] => {
		const doc = view.state.doc.toString();
		
		// Skip empty documents
		if (!doc.trim()) {
			return [];
		}
		
		try {
			parse(doc);
			return []; // No errors
		} catch (e) {
			if (e instanceof ParseError && e.span) {
				// Convert ParseError span to CodeMirror diagnostic
				return [{
					from: Math.min(e.span.start, doc.length),
					to: Math.min(e.span.end, doc.length),
					severity: "error",
					message: e.message,
					source: "TQL",
				}];
			}
			
			// Generic error - show at end of document
			return [{
				from: doc.length,
				to: doc.length,
				severity: "error",
				message: String(e),
				source: "TQL",
			}];
		}
	}, {
		delay: 300, // Debounce for performance
	});
}
