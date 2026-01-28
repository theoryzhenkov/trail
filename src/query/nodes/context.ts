/**
 * ExecutorContext - Mutable context for expression evaluation
 * 
 * Provides access to:
 * - Current file path and properties
 * - Traversal context
 * - Query context (graph access, settings)
 * - Error collection
 * - Helper methods (isTruthy, compare, equals)
 */

import type {
	Span,
	Value,
	RuntimeError,
	QueryContext,
	TraversalContext,
	FileMetadata,
	QueryWarning,
} from "./types";
import type {FileProperties, RelationEdge, VisualDirection} from "../../types";

/**
 * Mutable execution context for TQL evaluation
 */
export class ExecutorContext {
	private _filePath: string;
	private _properties: FileProperties;
	private _traversal?: TraversalContext;
	private _queryCtx: QueryContext;
	private _errors: RuntimeError[] = [];
	private _warnings: QueryWarning[] = [];

	constructor(queryCtx: QueryContext) {
		this._queryCtx = queryCtx;
		this._filePath = queryCtx.activeFilePath;
		this._properties = queryCtx.activeFileProperties;
	}

	// =========================================================================
	// Mutable State
	// =========================================================================

	/**
	 * Set the current file being evaluated
	 */
	setCurrentFile(path: string, props: FileProperties): void {
		this._filePath = path;
		this._properties = props;
	}

	/**
	 * Set the traversal context
	 */
	setTraversal(traversal: TraversalContext | undefined): void {
		this._traversal = traversal;
	}

	// =========================================================================
	// Getters
	// =========================================================================

	get filePath(): string {
		return this._filePath;
	}

	get properties(): FileProperties {
		return this._properties;
	}

	get traversal(): TraversalContext | undefined {
		return this._traversal;
	}

	get activeFilePath(): string {
		return this._queryCtx.activeFilePath;
	}

	get activeFileProperties(): FileProperties {
		return this._queryCtx.activeFileProperties;
	}

	// =========================================================================
	// Error Collection
	// =========================================================================

	/**
	 * Add a runtime error
	 */
	addError(message: string, span: Span): void {
		this._errors.push({
			name: "RuntimeError",
			message,
			span,
		} as RuntimeError);
	}

	/**
	 * Add a warning (non-fatal)
	 */
	addWarning(message: string): void {
		this._warnings.push({message});
	}

	/**
	 * Check if any errors have been collected
	 */
	hasErrors(): boolean {
		return this._errors.length > 0;
	}

	/**
	 * Get all collected errors
	 */
	getErrors(): RuntimeError[] {
		return this._errors;
	}

	/**
	 * Get all collected warnings
	 */
	getWarnings(): QueryWarning[] {
		return this._warnings;
	}

	/**
	 * Clear errors and warnings
	 */
	clearErrors(): void {
		this._errors = [];
		this._warnings = [];
	}

	// =========================================================================
	// Query Context Delegation
	// =========================================================================

	getOutgoingEdges(path: string, relation?: string): RelationEdge[] {
		return this._queryCtx.getOutgoingEdges(path, relation);
	}

	getIncomingEdges(path: string, relation?: string): RelationEdge[] {
		return this._queryCtx.getIncomingEdges(path, relation);
	}

	getProperties(path: string): FileProperties {
		return this._queryCtx.getProperties(path);
	}

	getFileMetadata(path: string): FileMetadata | undefined {
		return this._queryCtx.getFileMetadata(path);
	}

	getRelationNames(): string[] {
		return this._queryCtx.getRelationNames();
	}

	getVisualDirection(relation: string): VisualDirection {
		return this._queryCtx.getVisualDirection(relation);
	}

	getSequentialRelations(): Set<string> {
		return this._queryCtx.getSequentialRelations();
	}

	resolveGroupQuery(name: string): unknown {
		return this._queryCtx.resolveGroupQuery(name);
	}

	// =========================================================================
	// Helper Methods
	// =========================================================================

	/**
	 * Check if a value is truthy (TQL semantics)
	 */
	isTruthy(value: Value): boolean {
		if (value === null) return false;
		if (value === false) return false;
		if (value === 0) return false;
		if (value === "") return false;
		if (Array.isArray(value) && value.length === 0) return false;
		return true;
	}

	/**
	 * Compare two values (returns -1, 0, or 1)
	 */
	compare(a: Value, b: Value): number {
		if (a === b) return 0;
		if (a === null) return 1;
		if (b === null) return -1;

		if (typeof a === "number" && typeof b === "number") {
			return a - b;
		}
		if (typeof a === "string" && typeof b === "string") {
			return a.localeCompare(b);
		}
		if (a instanceof Date && b instanceof Date) {
			return a.getTime() - b.getTime();
		}

		return String(a).localeCompare(String(b));
	}

	/**
	 * Check if two values are equal (TQL semantics)
	 */
	equals(a: Value, b: Value): boolean {
		if (a === b) return true;
		if (a === null || b === null) return false;
		if (a instanceof Date && b instanceof Date) {
			return a.getTime() === b.getTime();
		}
		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) return false;
			return a.every((v, i) => this.equals(v, b[i] ?? null));
		}
		return a === b;
	}

	/**
	 * Convert duration to milliseconds
	 */
	durationToMs(value: number, unit: "d" | "w" | "m" | "y"): number {
		const day = 24 * 60 * 60 * 1000;
		switch (unit) {
			case "d":
				return value * day;
			case "w":
				return value * 7 * day;
			case "m":
				return value * 30 * day;
			case "y":
				return value * 365 * day;
		}
	}

	/**
	 * Get a property value from the current file.
	 * Supports nested YAML properties via dot notation.
	 * If nested traversal fails, tries the flat key as fallback.
	 * 
	 * Example: "obsidian.icon" will first try properties.obsidian.icon (nested),
	 * then fall back to properties["obsidian.icon"] (flat key).
	 */
	getPropertyValue(path: string): Value {
		const parts = path.split(".");
		
		// First try nested traversal (prioritized for nested YAML)
		let current: unknown = this._properties;
		for (const part of parts) {
			if (current === null || current === undefined) {
				break;
			}
			if (typeof current === "object" && current !== null) {
				current = (current as Record<string, unknown>)[part];
			} else {
				current = undefined;
				break;
			}
		}

		if (current !== undefined) {
			return (current === undefined ? null : current) as Value;
		}

		// Fallback: try flat key if nested traversal failed
		if (parts.length > 1) {
			const flatValue = this._properties[path];
			if (flatValue !== undefined) {
				return flatValue as Value;
			}
		}

		return null;
	}

	/**
	 * Get a file.* property
	 */
	getFileProperty(property: string): Value {
		const metadata = this._queryCtx.getFileMetadata(this._filePath);
		if (!metadata) return null;

		switch (property) {
			case "name":
				return metadata.name;
			case "path":
				return metadata.path;
			case "folder":
				return metadata.folder;
			case "created":
				return metadata.created;
			case "modified":
				return metadata.modified;
			case "size":
				return metadata.size;
			case "tags":
				return metadata.tags;
			default:
				return null;
		}
	}

	/**
	 * Get a traversal.* property
	 */
	getTraversalProperty(property: string): Value {
		if (!this._traversal) return null;

		switch (property) {
			case "depth":
				return this._traversal.depth;
			case "relation":
				return this._traversal.relation;
			case "isImplied":
				return this._traversal.isImplied;
			case "parent":
				return this._traversal.parent;
			case "path":
				return this._traversal.path;
			default:
				return null;
		}
	}

	/**
	 * Resolve a relative date to an absolute Date
	 */
	resolveRelativeDate(kind: string): Date {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		switch (kind) {
			case "today":
				return today;
			case "yesterday":
				return new Date(today.getTime() - 24 * 60 * 60 * 1000);
			case "tomorrow":
				return new Date(today.getTime() + 24 * 60 * 60 * 1000);
			case "startOfWeek": {
				const day = today.getDay();
				return new Date(today.getTime() - day * 24 * 60 * 60 * 1000);
			}
			case "endOfWeek": {
				const day = today.getDay();
				return new Date(today.getTime() + (6 - day) * 24 * 60 * 60 * 1000);
			}
			default:
				return today;
		}
	}
}

/**
 * Validation context implementation
 */
export class ValidationContextImpl {
	private _relationNames: string[];
	private _relationNamesLower: Set<string>;
	private _groupNames: Set<string>;
	private _errors: Array<{message: string; span: Span; code: string}> = [];

	constructor(relationNames: string[], groupNames: string[]) {
		this._relationNames = relationNames;
		this._relationNamesLower = new Set(relationNames.map(n => n.toLowerCase()));
		this._groupNames = new Set(groupNames);
	}

	getRelationNames(): string[] {
		return this._relationNames;
	}

	getGroupNames(): string[] {
		return Array.from(this._groupNames);
	}

	hasRelation(name: string): boolean {
		return this._relationNamesLower.has(name.toLowerCase());
	}

	hasGroup(name: string): boolean {
		return this._groupNames.has(name);
	}

	addError(message: string, span: Span, code: string): void {
		this._errors.push({message, span, code});
	}

	hasErrors(): boolean {
		return this._errors.length > 0;
	}

	getErrors(): Array<{message: string; span: Span; code: string}> {
		return this._errors;
	}
}

/**
 * Create a validation context from query context
 */
export function createValidationContext(
	relationNames: string[],
	groupNames: string[]
): ValidationContextImpl {
	return new ValidationContextImpl(relationNames, groupNames);
}
