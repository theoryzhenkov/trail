/**
 * DateLiteralNode - Date literal (ISO format)
 */

import {LiteralNode} from "../base/LiteralNode";
import {register} from "../registry";
import type {Span, NodeDoc} from "../types";

@register("date", {expr: true})
export class DateLiteralNode extends LiteralNode<Date> {
	static documentation: NodeDoc = {
		title: "Date Literal",
		description: "An ISO-format date. Can include time component.",
		syntax: "YYYY-MM-DD | YYYY-MM-DDTHH:MM:SS",
		examples: ["2024-01-15", "2024-06-30T14:30:00"],
	};

	static highlighting = "number" as const;

	constructor(value: Date, span: Span) {
		super(value, span);
	}
}
