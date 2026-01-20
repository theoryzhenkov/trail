/**
 * InlineQueryNode - Inline query expression for use in aggregate functions
 *
 * Syntax: @(from relation [where ...] [sort ...])
 * Executes a full query recursively and returns the result set.
 */

import {ExprNode} from "../base/ExprNode";
import {FromNode} from "../clauses/FromNode";
import {SortNode} from "../clauses/SortNode";
import {PruneNode} from "../clauses/PruneNode";
import {WhereNode} from "../clauses/WhereNode";
import type {Span, Value, NodeDoc, ValidationContext, QueryResultNode} from "../types";
import type {ExecutorContext} from "../context";
import {executeQueryClauses} from "../execution/query-executor";
import {register} from "../registry";

@register("InlineQueryNode", {expr: true})
export class InlineQueryNode extends ExprNode {
	readonly from: FromNode;
	readonly prune?: PruneNode;
	readonly where?: WhereNode;
	readonly sort?: SortNode;

	static documentation: NodeDoc = {
		title: "Inline Query",
		description:
			"Executes a query recursively from the current file context. Used as a source for aggregate functions.",
		syntax: "@(from relation [prune ...] [where ...] [sort ...])",
		examples: [
			"count(@(from down))",
			'count(@(from down where status = "done"))',
			"sum(@(from tasks depth 1), points)",
		],
	};

	static highlighting = "keyword" as const;

	constructor(from: FromNode, span: Span, prune?: PruneNode, where?: WhereNode, sort?: SortNode) {
		super(span);
		this.from = from;
		this.prune = prune;
		this.where = where;
		this.sort = sort;
	}

	/**
	 * Evaluate as an expression - returns array of file paths
	 */
	evaluate(ctx: ExecutorContext): Value {
		const results = this.executeQuery(ctx);
		return this.flattenPaths(results);
	}

	/**
	 * Execute the inline query and return full result nodes.
	 * Uses the shared query executor for full recursive functionality.
	 */
	executeQuery(ctx: ExecutorContext): QueryResultNode[] {
		return executeQueryClauses(ctx, {
			from: this.from,
			prune: this.prune,
			where: this.where,
			sort: this.sort,
			startPath: ctx.filePath, // Use current file, not active file
		});
	}

	private flattenPaths(nodes: QueryResultNode[]): string[] {
		const paths: string[] = [];
		for (const node of nodes) {
			paths.push(node.path);
			paths.push(...this.flattenPaths(node.children));
		}
		return paths;
	}

	validate(ctx: ValidationContext): void {
		this.from.validate(ctx);

		if (this.prune) {
			this.prune.validate(ctx);
		}
		if (this.where) {
			this.where.validate(ctx);
		}
		if (this.sort) {
			this.sort.validate(ctx);
		}
	}
}
