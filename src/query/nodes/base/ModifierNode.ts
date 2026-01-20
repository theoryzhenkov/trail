/**
 * Modifier Node Base Class
 *
 * Abstract base for modifier keywords that provide completion/documentation
 * metadata but are not instantiated in the AST. Modifiers are absorbed into
 * parent nodes as properties (e.g., :asc/:desc become SortKeyNode.direction).
 *
 * Examples: :asc, :desc, :depth, :flatten, :chain
 */

import type {NodeDoc, Completable, HighlightCategory} from "../types";

/**
 * Abstract base class for modifier nodes.
 * These are metadata-only - they register for completion/docs but don't
 * appear in the AST. Subclasses should only define static properties.
 */
export abstract class ModifierNode {
	/**
	 * The keyword for this modifier (including : prefix if applicable)
	 */
	static keyword: string;

	/**
	 * Documentation for hover/autocomplete
	 */
	static documentation: NodeDoc;

	/**
	 * Completion metadata
	 */
	static completable: Completable;

	/**
	 * Highlighting category for syntax highlighting
	 */
	static highlighting: HighlightCategory;
}
