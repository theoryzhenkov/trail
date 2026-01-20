/**
 * PropertyNode - Property access expression
 */

import {ExprNode} from "../base/ExprNode";
import type {Span, Value, NodeDoc, ValidationContext} from "../types";
import type {ExecutorContext} from "../context";

export class PropertyNode extends ExprNode {
	readonly path: string[];

	static documentation: NodeDoc = {
		title: "Property Access",
		description: "Access properties from the current file. Supports nested paths with dot notation.",
		syntax: "property | property.nested.path",
		examples: ["status", "file.name", "traversal.depth", "metadata.author"],
	};

	static highlighting = "variable" as const;

	constructor(path: string[], span: Span) {
		super(span);
		this.path = path;
	}

	evaluate(ctx: ExecutorContext): Value {
		// Handle traversal.* properties
		if (this.path[0] === "traversal" && this.path[1]) {
			return ctx.getTraversalProperty(this.path[1]);
		}

		// Handle file.* properties
		if (this.path[0] === "file" && this.path[1]) {
			return ctx.getFileProperty(this.path[1]);
		}

		// Regular property access
		return ctx.getPropertyValue(this.path.join("."));
	}

	validate(ctx: ValidationContext): void {
		if (this.path.length === 0) {
			ctx.addError("Empty property path", this.span, "TYPE_MISMATCH");
		}
	}
}
