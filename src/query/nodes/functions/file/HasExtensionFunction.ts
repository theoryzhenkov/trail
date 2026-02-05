/**
 * hasExtension(ext) - Check file extension
 */

import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {EvalContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("HasExtensionNode", {function: "hasExtension"})
export class HasExtensionFunction extends FunctionExprNode {
	static minArity = 1;
	static maxArity = 1;
	static documentation: NodeDoc = {
		title: "hasExtension",
		description: "Check if file has the specified extension.",
		syntax: "hasExtension(ext)",
		returnType: "boolean",
		examples: ['hasExtension("md")', 'hasExtension("pdf")'],
	};

	constructor(args: ExprNode[], span: Span) {
		super(args, span);
	}

	evaluate(ctx: EvalContext): Value {
		const args = this.evaluateArgs(ctx);
		const ext = toString(args[0] ?? null).toLowerCase();
		const path = ctx.filePath.toLowerCase();
		const expectedExt = ext.startsWith(".") ? ext : "." + ext;
		return path.endsWith(expectedExt);
	}
}
