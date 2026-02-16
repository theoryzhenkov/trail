/**
 * DISPLAY Transform
 *
 * Evaluates display properties for each result node.
 * Extracts the display logic that was previously embedded in QueryNode.
 */

import type {QueryTransform} from "../pipeline";
import type {QueryEnv, EvalContext} from "../../context";
import {evalContextFromNode} from "../../context";
import type {DisplayNode} from "../../clauses/DisplayNode";
import type {QueryResultNode, DisplayProperty} from "../../types";

export class DisplayTransform implements QueryTransform {
	constructor(private readonly display: DisplayNode) {}

	apply(nodes: QueryResultNode[], env: QueryEnv): QueryResultNode[] {
		return this.applyDisplay(nodes, env);
	}

	private applyDisplay(nodes: QueryResultNode[], env: QueryEnv): QueryResultNode[] {
		return nodes.map((node) => {
			const nodeCtx = evalContextFromNode(env, node);

			return {
				...node,
				displayProperties: this.evaluateDisplayProperties(node, nodeCtx),
				children: this.applyDisplay(node.children, env),
			};
		});
	}

	private evaluateDisplayProperties(node: QueryResultNode, ctx: EvalContext): DisplayProperty[] {
		const results: DisplayProperty[] = [];

		// Handle "display all" - include all frontmatter properties
		if (this.display.all) {
			for (const [key, value] of Object.entries(node.properties)) {
				if (key.startsWith("file.") || key.startsWith("traversal.")) continue;
				results.push({key, value: value as DisplayProperty["value"]});
			}
		}

		// Evaluate explicit properties using PropertyNode.evaluate()
		for (const prop of this.display.properties) {
			const frontmatterPath = prop.getFrontmatterPath();
			const key = frontmatterPath ?? prop.path.join(".");
			const value = prop.evaluate(ctx);

			// Skip if already added by "all" and this is a frontmatter property
			if (this.display.all && frontmatterPath) {
				if (results.some((r) => r.key === frontmatterPath)) {
					continue;
				}
			}

			results.push({key, value});
		}

		return results;
	}
}
