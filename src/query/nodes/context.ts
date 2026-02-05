/**
 * Query execution context types
 *
 * Split into two concerns:
 * - QueryEnv: Read-only per-query environment (graph access, error collection, utilities)
 * - EvalContext: Per-node evaluation context constructed fresh for each evaluate() call
 */

import type {
	Span,
	Value,
	RuntimeError,
	QueryContext,
	TraversalContext,
	FileMetadata,
	QueryWarning,
	QueryResultNode,
} from "./types";
import type {FileProperties, RelationEdge, VisualDirection} from "../../types";

// =============================================================================
// QueryEnv - Read-only per-query environment
// =============================================================================

/**
 * Read-only query environment shared across the entire query execution.
 *
 * Provides graph access, error collection, and pure utility methods.
 * Does NOT hold mutable per-node state.
 */
export class QueryEnv {
	private _queryCtx: QueryContext;
	private _errors: RuntimeError[] = [];
	private _warnings: QueryWarning[] = [];

	constructor(queryCtx: QueryContext) {
		this._queryCtx = queryCtx;
	}

	// =========================================================================
	// Active File (immutable per query)
	// =========================================================================

	get activeFilePath(): string {
		return this._queryCtx.activeFilePath;
	}

	get activeFileProperties(): FileProperties {
		return this._queryCtx.activeFileProperties;
	}

	// =========================================================================
	// Error Collection
	// =========================================================================

	addError(message: string, span: Span): void {
		this._errors.push({
			name: "RuntimeError",
			message,
			span,
		} as RuntimeError);
	}

	addWarning(message: string): void {
		this._warnings.push({message});
	}

	hasErrors(): boolean {
		return this._errors.length > 0;
	}

	getErrors(): RuntimeError[] {
		return this._errors;
	}

	getWarnings(): QueryWarning[] {
		return this._warnings;
	}

	clearErrors(): void {
		this._errors = [];
		this._warnings = [];
	}

	// =========================================================================
	// Graph Access (delegated to QueryContext)
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

	resolveGroupQuery(name: string): unknown {
		return this._queryCtx.resolveGroupQuery(name);
	}

	// =========================================================================
	// Pure Utility Methods
	// =========================================================================

	isTruthy(value: Value): boolean {
		if (value === null) return false;
		if (value === false) return false;
		if (value === 0) return false;
		if (value === "") return false;
		if (Array.isArray(value) && value.length === 0) return false;
		return true;
	}

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

// =============================================================================
// EvalContext - Per-node evaluation context
// =============================================================================

/**
 * Per-node evaluation context constructed fresh for each evaluate() call.
 *
 * Holds the current file path, properties, and optional traversal context.
 * Provides convenience methods that read from per-node state.
 */
export class EvalContext {
	readonly filePath: string;
	readonly properties: FileProperties;
	readonly traversal: TraversalContext | undefined;
	readonly env: QueryEnv;

	constructor(
		env: QueryEnv,
		filePath: string,
		properties: FileProperties,
		traversal?: TraversalContext
	) {
		this.env = env;
		this.filePath = filePath;
		this.properties = properties;
		this.traversal = traversal;
	}

	/**
	 * Get a property value from the current file.
	 * Supports nested YAML properties via dot notation.
	 * If nested traversal fails, tries the flat key as fallback.
	 */
	getPropertyValue(path: string): Value {
		const parts = path.split(".");

		// First try nested traversal (prioritized for nested YAML)
		let current: unknown = this.properties;
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
			const flatValue = this.properties[path];
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
		const metadata = this.env.getFileMetadata(this.filePath);
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
		if (!this.traversal) return null;

		switch (property) {
			case "depth":
				return this.traversal.depth;
			case "relation":
				return this.traversal.relation;
			case "isImplied":
				return this.traversal.isImplied;
			case "parent":
				return this.traversal.parent;
			case "path":
				return this.traversal.path;
			default:
				return null;
		}
	}
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an EvalContext from a QueryResultNode
 */
export function evalContextFromNode(env: QueryEnv, node: QueryResultNode): EvalContext {
	return new EvalContext(env, node.path, node.properties, {
		depth: node.depth,
		relation: node.relation,
		isImplied: node.implied,
		parent: node.parent,
		path: node.traversalPath,
	});
}

/**
 * Create an EvalContext for the active file (no traversal)
 */
export function evalContextForActiveFile(env: QueryEnv): EvalContext {
	return new EvalContext(env, env.activeFilePath, env.activeFileProperties);
}

// =============================================================================
// Validation Context (unchanged)
// =============================================================================

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
		this._relationNamesLower = new Set(relationNames.map((n) => n.toLowerCase()));
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
