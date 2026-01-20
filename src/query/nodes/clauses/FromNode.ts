/**
 * FromNode - FROM clause
 */

import {ClauseNode} from "../base/ClauseNode";
import {RelationSpecNode} from "./RelationSpecNode";
import type {Span, NodeDoc, ValidationContext} from "../types";

export class FromNode extends ClauseNode {
	readonly relations: RelationSpecNode[];

	static documentation: NodeDoc = {
		title: "FROM clause",
		description: "Specifies which relations to traverse from the active file.",
		syntax: "from relation [modifiers], ...",
		examples: ["from up", "from up, down depth 2", "from up extend Children"],
	};

	constructor(relations: RelationSpecNode[], span: Span) {
		super(span);
		this.relations = relations;
	}

	validate(ctx: ValidationContext): void {
		for (const rel of this.relations) {
			rel.validate(ctx);
		}
	}
}
