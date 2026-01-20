/**
 * DisplayNode - DISPLAY clause
 */

import {ClauseNode} from "../base/ClauseNode";
import {PropertyNode} from "../expressions/PropertyNode";
import type {Span, NodeDoc, ValidationContext, CompletionContext, Completable} from "../types";
import {register} from "../registry";

@register("DisplayNode", {clause: true})
export class DisplayNode extends ClauseNode {
	readonly all: boolean;
	readonly properties: PropertyNode[];

	static providesContexts: CompletionContext[] = ["display", "clause"];

	static documentation: NodeDoc = {
		title: "DISPLAY clause",
		description: "Specifies which properties to show in the Trail pane UI.",
		syntax: "display Property, ... | all [, Property, ...]",
		examples: ["display status, priority", "display all", "display all, file.modified"],
	};

	static completable: Completable = {
		keywords: ["display"],
		context: "clause",
		priority: 40,
		category: "keyword",
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
