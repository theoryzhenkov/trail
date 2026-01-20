/**
 * TQL Hover Provider for CodeMirror 6
 * 
 * Shows documentation and type info on hover.
 * Documentation is sourced from static properties on node classes.
 */

import {hoverTooltip, Tooltip, EditorView} from "@codemirror/view";
import {FUNCTION_DOCS, FILE_PROPERTIES, TRAVERSAL_PROPERTIES} from "./autocomplete";
import {getKeywordDoc} from "../nodes/docs";

/**
 * Get word at position
 */
function getWordAt(doc: string, pos: number): {word: string; from: number; to: number} | null {
	// Find word boundaries
	let from = pos;
	let to = pos;
	
	// Scan backward
	while (from > 0 && /[\w.]/.test(doc[from - 1] ?? "")) {
		from--;
	}
	
	// Scan forward
	while (to < doc.length && /[\w.]/.test(doc[to] ?? "")) {
		to++;
	}
	
	if (from === to) return null;
	
	return {
		word: doc.slice(from, to),
		from,
		to,
	};
}

interface TooltipOptions {
	title: string;
	description: string;
	syntax?: string;
	examples?: string[];
	extra?: string;
}

/**
 * Create tooltip content
 */
function createTooltipContent(word: string): HTMLElement | null {
	const wordLower = word.toLowerCase();
	
	// Check keyword docs from node classes
	const keywordDoc = getKeywordDoc(word);
	if (keywordDoc) {
		return createTooltipElement({
			title: keywordDoc.title,
			description: keywordDoc.description,
			syntax: keywordDoc.syntax,
			examples: keywordDoc.examples,
		});
	}
	
	// Check if it's a function (might be followed by parenthesis)
	const funcDoc = FUNCTION_DOCS[word] || FUNCTION_DOCS[wordLower];
	if (funcDoc) {
		return createTooltipElement({
			title: funcDoc.signature,
			description: funcDoc.description,
			extra: `Returns: ${funcDoc.returnType}`,
		});
	}
	
	// Check file properties
	const fileProp = FILE_PROPERTIES.find(p => p.name === word);
	if (fileProp) {
		return createTooltipElement({
			title: fileProp.name,
			description: fileProp.description,
			extra: `Type: ${fileProp.type}`,
		});
	}
	
	// Check traversal properties
	const traversalProp = TRAVERSAL_PROPERTIES.find(p => p.name === word);
	if (traversalProp) {
		return createTooltipElement({
			title: traversalProp.name,
			description: traversalProp.description,
			extra: `Type: ${traversalProp.type}`,
		});
	}
	
	// Check if it starts with file. or traversal.
	if (word.startsWith("file.")) {
		const prop = FILE_PROPERTIES.find(p => p.name === word);
		if (prop) {
			return createTooltipElement({
				title: prop.name,
				description: prop.description,
				extra: `Type: ${prop.type}`,
			});
		}
	}
	
	if (word.startsWith("traversal.")) {
		const prop = TRAVERSAL_PROPERTIES.find(p => p.name === word);
		if (prop) {
			return createTooltipElement({
				title: prop.name,
				description: prop.description,
				extra: `Type: ${prop.type}`,
			});
		}
	}
	
	return null;
}

/**
 * Create tooltip HTML element
 */
function createTooltipElement(opts: TooltipOptions): HTMLElement {
	const container = document.createElement("div");
	container.className = "tql-hover-tooltip";
	
	// Title
	const titleEl = document.createElement("div");
	titleEl.className = "tql-hover-title";
	titleEl.textContent = opts.title;
	container.appendChild(titleEl);
	
	// Description
	const descEl = document.createElement("div");
	descEl.className = "tql-hover-description";
	descEl.textContent = opts.description;
	container.appendChild(descEl);
	
	// Syntax schema
	if (opts.syntax) {
		const syntaxSection = document.createElement("div");
		syntaxSection.className = "tql-hover-section";
		
		const syntaxLabel = document.createElement("div");
		syntaxLabel.className = "tql-hover-label";
		syntaxLabel.textContent = "Syntax";
		syntaxSection.appendChild(syntaxLabel);
		
		const syntaxCode = document.createElement("code");
		syntaxCode.className = "tql-hover-syntax";
		syntaxCode.textContent = opts.syntax;
		syntaxSection.appendChild(syntaxCode);
		
		container.appendChild(syntaxSection);
	}
	
	// Examples
	if (opts.examples && opts.examples.length > 0) {
		const examplesSection = document.createElement("div");
		examplesSection.className = "tql-hover-section";
		
		const examplesLabel = document.createElement("div");
		examplesLabel.className = "tql-hover-label";
		examplesLabel.textContent = opts.examples.length === 1 ? "Example" : "Examples";
		examplesSection.appendChild(examplesLabel);
		
		const examplesList = document.createElement("div");
		examplesList.className = "tql-hover-examples";
		for (const example of opts.examples) {
			const exampleEl = document.createElement("code");
			exampleEl.className = "tql-hover-example";
			exampleEl.textContent = example;
			examplesList.appendChild(exampleEl);
		}
		examplesSection.appendChild(examplesList);
		
		container.appendChild(examplesSection);
	}
	
	// Extra info (like return type)
	if (opts.extra) {
		const extraEl = document.createElement("div");
		extraEl.className = "tql-hover-extra";
		extraEl.textContent = opts.extra;
		container.appendChild(extraEl);
	}
	
	return container;
}

/**
 * Create TQL hover provider
 */
export function createTQLHover() {
	return hoverTooltip((view: EditorView, pos: number): Tooltip | null => {
		const doc = view.state.doc.toString();
		const wordInfo = getWordAt(doc, pos);
		
		if (!wordInfo) return null;
		
		const content = createTooltipContent(wordInfo.word);
		if (!content) return null;
		
		return {
			pos: wordInfo.from,
			end: wordInfo.to,
			above: true,
			create: () => ({dom: content}),
		};
	}, {
		hoverTime: 300,
	});
}
