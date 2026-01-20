/**
 * PropertyNode - Property access expression
 */

import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {ExecutorContext} from "../context";
import {register} from "../registry";

@register("PropertyNode", {expr: true})
export class PropertyNode extends ExprNode {
	readonly path: string[];
	readonly isBuiltin: boolean;

	static documentation: NodeDoc = {
		title: "Property Access",
		description: "Access properties from the current file. Supports nested paths with dot notation. Use $ prefix for built-in properties like $file.name and $traversal.depth.",
		syntax: "property | property.nested.path | $file.name | $traversal.depth",
		examples: ["status", "$file.name", "$traversal.depth", "metadata.author"],
	};

	static highlighting = "variable" as const;

	constructor(path: string[], span: Span, isBuiltin: boolean = false) {
		super(span);
		this.path = path;
		this.isBuiltin = isBuiltin;
	}

	evaluate(ctx: ExecutorContext): Value {
		if (this.isBuiltin) {
			// Handle $traversal.* properties
			if (this.path[0] === "traversal" && this.path[1]) {
				return ctx.getTraversalProperty(this.path[1]);
			}

			// Handle $file.* properties
			if (this.path[0] === "file" && this.path[1]) {
				return ctx.getFileProperty(this.path[1]);
			}

			// Unknown built-in
			return null;
		}

		// Regular frontmatter property access
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
