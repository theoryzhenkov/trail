/**
 * PropertyNode - Property access expression
 */

import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {EvalContext} from "../context";
import {register} from "../registry";

@register("PropertyNode", {expr: true})
export class PropertyNode extends ExprNode {
	readonly path: string[];
	readonly isBuiltin: boolean;

	static documentation: NodeDoc = {
		title: "Property Access",
		description: "Access frontmatter properties directly by name, with dot notation for nested YAML. Use $file.* for file metadata (name, path, created). Use $traversal.* for traversal context.",
		syntax: "property | nested.path | $file.name | $traversal.depth",
		examples: ["status", "obsidian.icon", "$file.name", "$traversal.depth"],
	};

	static highlighting = "variable" as const;

	constructor(path: string[], span: Span, isBuiltin: boolean = false) {
		super(span);
		this.path = path;
		this.isBuiltin = isBuiltin;
	}

	/**
	 * Get the frontmatter property path for sorting/display.
	 * For $file.properties.x.y, returns "x.y"
	 * For $file.* (metadata), returns null (use isFileMetadata to check)
	 * For regular properties like status.x, returns "status.x"
	 */
	getFrontmatterPath(): string | null {
		if (this.isBuiltin) {
			// $file.properties.* -> extract property path
			if (this.path[0] === "file" && this.path[1] === "properties") {
				const propertyPath = this.path.slice(2);
				return propertyPath.length > 0 ? propertyPath.join(".") : null;
			}
			// $file.* (metadata) or $traversal.* - not frontmatter
			return null;
		}
		// Regular property access
		return this.path.join(".");
	}

	/**
	 * Check if this is a $file.* metadata access (not $file.properties.*)
	 */
	isFileMetadata(): boolean {
		return this.isBuiltin && this.path[0] === "file" && this.path[1] !== "properties";
	}

	evaluate(ctx: EvalContext): Value {
		if (this.isBuiltin) {
			// Handle $traversal.* properties
			if (this.path[0] === "traversal" && this.path[1]) {
				return ctx.getTraversalProperty(this.path[1]);
			}

			// Handle $file.* properties
			if (this.path[0] === "file") {
				// Handle $file.properties.* - access frontmatter with nested YAML support
				if (this.path[1] === "properties") {
					const propertyPath = this.path.slice(2);
					if (propertyPath.length === 0) {
						// $file.properties alone - return all properties
						return ctx.properties as unknown as Value;
					}
					return ctx.getPropertyValue(propertyPath.join("."));
				}
				
				// Handle other $file.* properties (name, path, created, etc.)
				if (this.path[1]) {
					return ctx.getFileProperty(this.path[1]);
				}
			}

			// Unknown built-in
			return null;
		}

		// Regular frontmatter property access (legacy support)
		return ctx.getPropertyValue(this.path.join("."));
	}

	validate(ctx: ValidationContext): void {
		if (this.path.length === 0) {
			ctx.addError("Empty property path", this.span, "TYPE_MISMATCH");
		}

		if (this.isBuiltin) {
			const validBuiltins = ["file", "traversal"];
			if (!validBuiltins.includes(this.path[0] ?? "")) {
				ctx.addError(
					`Unknown built-in namespace: $${this.path[0]}. Valid namespaces: $file, $traversal`,
					this.span,
					"TYPE_MISMATCH"
				);
			}
		}
	}
}
