/**
 * DisplayNode - DISPLAY clause
 */

import {ClauseNode} from "../base/ClauseNode";
import {PropertyNode} from "../expressions/PropertyNode";
import {register} from "../registry";
import type {Span, NodeDoc, ValidationContext} from "../types";

@register("display")
export class DisplayNode extends ClauseNode {
	readonly all: boolean;
	readonly properties: PropertyNode[];

	static documentation: NodeDoc = {
		title: "DISPLAY clause",
		description: "Specifies which properties to show in the Trail pane UI.",
		syntax: "display all | display property, ...",
		examples: ["display all", "display status, priority", "display all, file.modified"],
	};

	constructor(all: boolean, properties: PropertyNode[], span: Span) {
		super(span);
		this.all = all;
		this.properties = properties;
	}

	validate(ctx: ValidationContext): void {
		for (const prop of this.properties) {
			prop.validate(ctx);
		}
	}
}
