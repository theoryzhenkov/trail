/**
 * TQL Hover Provider for CodeMirror 6
 * 
 * Shows documentation and type info on hover.
 */

import {hoverTooltip, Tooltip, EditorView} from "@codemirror/view";
import {FUNCTION_DOCS, FILE_PROPERTIES, TRAVERSAL_PROPERTIES} from "./autocomplete";

/**
 * Keyword documentation
 */
const KEYWORD_DOCS: Record<string, {title: string; description: string}> = {
	group: {
		title: "GROUP clause",
		description: "Defines the name of this query group. Required.",
	},
	from: {
		title: "FROM clause",
		description: "Specifies which relations to traverse. Supports multiple relations with depth and extend modifiers.",
	},
	prune: {
		title: "PRUNE clause",
		description: "Stops traversal at nodes matching the expression. Children are not visited.",
	},
	where: {
		title: "WHERE clause",
		description: "Filters results after traversal. Nodes not matching are hidden but their children may still appear.",
	},
	when: {
		title: "WHEN clause",
		description: "Conditional visibility. If the active file doesn't match, the entire group is hidden.",
	},
	sort: {
		title: "SORT clause",
		description: "Orders results by property or chain position.",
	},
	display: {
		title: "DISPLAY clause",
		description: "Specifies which properties to show in the UI.",
	},
	depth: {
		title: "depth modifier",
		description: "Sets how many levels to traverse. Use a number or 'unlimited'.",
	},
	unlimited: {
		title: "unlimited",
		description: "Traverse to any depth (no limit).",
	},
	extend: {
		title: "extend modifier",
		description: "At leaf nodes, continue traversal using another group's definition.",
	},
	and: {
		title: "AND operator",
		description: "Logical AND. Both conditions must be true.",
	},
	or: {
		title: "OR operator",
		description: "Logical OR. At least one condition must be true.",
	},
	not: {
		title: "NOT operator",
		description: "Logical NOT. Inverts the condition.",
	},
	in: {
		title: "IN operator",
		description: "Checks membership in array or substring in string.",
	},
	chain: {
		title: "chain sort",
		description: "Sorts by sequence position for sequential relations (next/prev).",
	},
	asc: {
		title: "asc",
		description: "Ascending sort order (A-Z, 0-9).",
	},
	desc: {
		title: "desc",
		description: "Descending sort order (Z-A, 9-0).",
	},
	all: {
		title: "all",
		description: "Display all frontmatter properties.",
	},
	today: {
		title: "today",
		description: "Current date at midnight.",
	},
	yesterday: {
		title: "yesterday",
		description: "Previous day at midnight.",
	},
	tomorrow: {
		title: "tomorrow",
		description: "Next day at midnight.",
	},
	startOfWeek: {
		title: "startOfWeek",
		description: "First day of the current week (Sunday).",
	},
	endOfWeek: {
		title: "endOfWeek",
		description: "Last day of the current week (Saturday).",
	},
};

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

/**
 * Create tooltip content
 */
function createTooltipContent(word: string): HTMLElement | null {
	const wordLower = word.toLowerCase();
	
	// Check keyword docs
	if (KEYWORD_DOCS[wordLower]) {
		const doc = KEYWORD_DOCS[wordLower];
		return createTooltipElement(doc.title, doc.description);
	}
	
	// Check if it's a function (might be followed by parenthesis)
	const funcDoc = FUNCTION_DOCS[word] || FUNCTION_DOCS[wordLower];
	if (funcDoc) {
		return createTooltipElement(
			funcDoc.signature,
			funcDoc.description,
			`Returns: ${funcDoc.returnType}`
		);
	}
	
	// Check file properties
	const fileProp = FILE_PROPERTIES.find(p => p.name === word);
	if (fileProp) {
		return createTooltipElement(
			fileProp.name,
			fileProp.description,
			`Type: ${fileProp.type}`
		);
	}
	
	// Check traversal properties
	const traversalProp = TRAVERSAL_PROPERTIES.find(p => p.name === word);
	if (traversalProp) {
		return createTooltipElement(
			traversalProp.name,
			traversalProp.description,
			`Type: ${traversalProp.type}`
		);
	}
	
	// Check if it starts with file. or traversal.
	if (word.startsWith("file.")) {
		const prop = FILE_PROPERTIES.find(p => p.name === word);
		if (prop) {
			return createTooltipElement(prop.name, prop.description, `Type: ${prop.type}`);
		}
	}
	
	if (word.startsWith("traversal.")) {
		const prop = TRAVERSAL_PROPERTIES.find(p => p.name === word);
		if (prop) {
			return createTooltipElement(prop.name, prop.description, `Type: ${prop.type}`);
		}
	}
	
	return null;
}

/**
 * Create tooltip HTML element
 */
function createTooltipElement(title: string, description: string, extra?: string): HTMLElement {
	const container = document.createElement("div");
	container.className = "tql-hover-tooltip";
	
	const titleEl = document.createElement("div");
	titleEl.className = "tql-hover-title";
	titleEl.textContent = title;
	container.appendChild(titleEl);
	
	const descEl = document.createElement("div");
	descEl.className = "tql-hover-description";
	descEl.textContent = description;
	container.appendChild(descEl);
	
	if (extra) {
		const extraEl = document.createElement("div");
		extraEl.className = "tql-hover-extra";
		extraEl.textContent = extra;
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
