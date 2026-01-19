/**
 * TQL Hover Provider for CodeMirror 6
 * 
 * Shows documentation and type info on hover.
 */

import {hoverTooltip, Tooltip, EditorView} from "@codemirror/view";
import {FUNCTION_DOCS, FILE_PROPERTIES, TRAVERSAL_PROPERTIES} from "./autocomplete";

interface KeywordDoc {
	title: string;
	description: string;
	syntax?: string;
	examples?: string[];
}

/**
 * Keyword documentation with syntax and examples
 */
const KEYWORD_DOCS: Record<string, KeywordDoc> = {
	group: {
		title: "GROUP clause",
		description: "Defines the name of this query group. Required as the first clause.",
		syntax: 'group "Name"',
		examples: [
			'group "Ancestors"',
			'group "Related Projects"',
		],
	},
	from: {
		title: "FROM clause",
		description: "Specifies which relations to traverse. Supports multiple relations with depth and extend modifiers.",
		syntax: "from Relation [depth N|unlimited] [extend Group], ...",
		examples: [
			"from up depth unlimited",
			"from up, down depth 2",
			"from up extend Children depth 5",
			"from parent, child depth 3",
		],
	},
	prune: {
		title: "PRUNE clause",
		description: "Stops traversal at nodes matching the expression. Matching nodes and their subtrees are not visited.",
		syntax: "prune Expression",
		examples: [
			'prune status = "archived"',
			'prune hasTag("private")',
			"prune traversal.depth > 5",
		],
	},
	where: {
		title: "WHERE clause",
		description: "Filters results after traversal. Non-matching nodes are hidden but their children may still appear with a gap indicator.",
		syntax: "where Expression",
		examples: [
			"where priority >= 3",
			'where status !=? "archived"',
			'where hasTag("active") and exists(due)',
		],
	},
	when: {
		title: "WHEN clause",
		description: "Conditional visibility for the entire group. If the active file doesn't match, the group is hidden.",
		syntax: "when Expression",
		examples: [
			'when type = "project"',
			'when hasTag("daily")',
			'when file.folder = "Projects"',
		],
	},
	sort: {
		title: "SORT clause",
		description: "Orders results by property or chain position. Multiple sort keys are comma-separated.",
		syntax: "sort by Key [asc|desc], ...",
		examples: [
			"sort by date desc",
			"sort by chain, priority desc",
			"sort by file.modified desc, file.name",
		],
	},
	display: {
		title: "DISPLAY clause",
		description: "Specifies which properties to show in the Trail pane UI.",
		syntax: "display Property, ... | all [, Property, ...]",
		examples: [
			"display status, priority",
			"display all",
			"display all, file.modified",
		],
	},
	depth: {
		title: "depth modifier",
		description: "Sets how many levels to traverse for a relation. Use a number or 'unlimited'.",
		syntax: "depth N | depth unlimited",
		examples: [
			"from up depth 3",
			"from down depth unlimited",
		],
	},
	unlimited: {
		title: "unlimited",
		description: "Traverse to any depth with no limit. This is the default if depth is not specified.",
		examples: [
			"from up depth unlimited",
		],
	},
	extend: {
		title: "extend modifier",
		description: "At leaf nodes, continue traversal using another group's FROM definition.",
		syntax: 'extend GroupName | extend "Group Name"',
		examples: [
			"from up extend Children",
			'from up extend "My Group" depth 5',
		],
	},
	flatten: {
		title: "flatten modifier",
		description: "Output all reachable nodes as a flat list at depth 1, instead of a nested tree structure. Useful for symmetric relations like 'same' that form cliques.",
		syntax: "Relation [depth N|unlimited] flatten",
		examples: [
			"from same depth unlimited flatten",
			"from down depth 2 flatten",
		],
	},
	and: {
		title: "AND operator",
		description: "Logical AND. Both conditions must be true.",
		syntax: "Expr and Expr",
		examples: [
			'status = "active" and priority > 3',
			"hasTag(\"work\") and file.folder = \"Projects\"",
		],
	},
	or: {
		title: "OR operator",
		description: "Logical OR. At least one condition must be true.",
		syntax: "Expr or Expr",
		examples: [
			'type = "note" or type = "project"',
			"priority > 5 or hasTag(\"urgent\")",
		],
	},
	not: {
		title: "NOT operator",
		description: "Logical NOT. Inverts the condition. Can also use '!' prefix.",
		syntax: "not Expr | !Expr",
		examples: [
			'not status = "archived"',
			"!hasTag(\"private\")",
		],
	},
	in: {
		title: "IN operator",
		description: "Checks membership in array, substring in string, or value in range.",
		syntax: "Value in Collection | Value in Lower..Upper",
		examples: [
			'"tag" in tags',
			'"sub" in title',
			"priority in 1..5",
			"date in 2024-01-01..today",
		],
	},
	chain: {
		title: "chain sort",
		description: "Sorts by sequence position for sequential relations (next/prev). Only meaningful in sort clause.",
		examples: [
			"sort by chain",
			"sort by chain, date desc",
		],
	},
	asc: {
		title: "asc",
		description: "Ascending sort order (A-Z, 0-9, oldest first). This is the default.",
		examples: [
			"sort by priority asc",
			"sort by file.name asc",
		],
	},
	desc: {
		title: "desc",
		description: "Descending sort order (Z-A, 9-0, newest first).",
		examples: [
			"sort by date desc",
			"sort by priority desc",
		],
	},
	all: {
		title: "all",
		description: "Display all frontmatter properties. Can be combined with specific file.* properties.",
		examples: [
			"display all",
			"display all, file.created",
		],
	},
	today: {
		title: "today",
		description: "Current date at midnight. Supports arithmetic with durations.",
		examples: [
			"date = today",
			"date > today - 7d",
		],
	},
	yesterday: {
		title: "yesterday",
		description: "Previous day at midnight.",
		examples: [
			"date = yesterday",
			"created > yesterday",
		],
	},
	tomorrow: {
		title: "tomorrow",
		description: "Next day at midnight.",
		examples: [
			"due = tomorrow",
			"due < tomorrow + 7d",
		],
	},
	startOfWeek: {
		title: "startOfWeek",
		description: "First day of the current week (Sunday) at midnight.",
		examples: [
			"date >= startOfWeek",
			"modified > startOfWeek",
		],
	},
	endOfWeek: {
		title: "endOfWeek",
		description: "Last day of the current week (Saturday) at midnight.",
		examples: [
			"due <= endOfWeek",
		],
	},
	by: {
		title: "by keyword",
		description: "Used after 'sort' to introduce sort keys.",
		syntax: "sort by Key [asc|desc], ...",
		examples: [
			"sort by date desc",
			"sort by chain, priority",
		],
	},
	true: {
		title: "true",
		description: "Boolean true literal.",
		examples: [
			"where active = true",
			"prune archived = true",
		],
	},
	false: {
		title: "false",
		description: "Boolean false literal.",
		examples: [
			"where active = false",
			"where draft != false",
		],
	},
	null: {
		title: "null",
		description: "Null value. Use =? and !=? for null-safe comparisons.",
		examples: [
			"where status != null",
			"where priority =? null",
		],
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
	
	// Check keyword docs
	if (KEYWORD_DOCS[wordLower]) {
		const doc = KEYWORD_DOCS[wordLower];
		return createTooltipElement({
			title: doc.title,
			description: doc.description,
			syntax: doc.syntax,
			examples: doc.examples,
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
