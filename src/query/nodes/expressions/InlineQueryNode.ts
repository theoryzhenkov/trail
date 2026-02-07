/**
 * InlineQueryNode - Inline query expression for use in aggregate functions
 *
 * Syntax: @(from relation [where ...] [sort ...])
 * Executes a full query recursively and returns the result set.
 */

import type {SyntaxNode} from "@lezer/common";
import {ExprNode} from "../base/ExprNode";
import {FromNode} from "../clauses/FromNode";
import {SortNode} from "../clauses/SortNode";
import {PruneNode} from "../clauses/PruneNode";
import {WhereNode} from "../clauses/WhereNode";
import type {Span, Value, NodeDoc, ValidationContext, QueryResultNode} from "../types";
import type {EvalContext} from "../context";
import type {QueryEnv} from "../context";
import {executeQueryClauses} from "../execution/query-executor";
import {register, type ConvertContext} from "../registry";
import {getSingleClause} from "./convert-helpers";

@register("InlineQueryNode", {expr: true, term: "InlineQuery"})
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
	evaluate(ctx: EvalContext): Value {
		const results = this.executeQuery(ctx.env, ctx.filePath);
		return this.flattenPaths(results);
	}

	/**
	 * Execute the inline query and return full result nodes.
	 * Uses the shared query executor for full recursive functionality.
	 */
	executeQuery(env: QueryEnv, startPath: string): QueryResultNode[] {
		return executeQueryClauses(env, {
			from: this.from,
			prune: this.prune,
			where: this.where,
			sort: this.sort,
			startPath, // Use current file, not active file
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

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): InlineQueryNode {
		const bodyNode = node.getChild("InlineQueryBody");
		if (!bodyNode) throw new Error("Missing inline query body");

		const fromNode = getSingleClause(bodyNode, "InlineClause", "From", "from", true, ctx)!;
		const pruneNode = getSingleClause(bodyNode, "InlineClause", "Prune", "prune", false, ctx);
		const whereNode = getSingleClause(bodyNode, "InlineClause", "Where", "where", false, ctx);
		const sortNode = getSingleClause(bodyNode, "InlineClause", "Sort", "sort", false, ctx);

		const from = FromNode.fromSyntax(fromNode, ctx);
		const prune = pruneNode ? PruneNode.fromSyntax(pruneNode, ctx) : undefined;
		const where = whereNode ? WhereNode.fromSyntax(whereNode, ctx) : undefined;
		const sort = sortNode ? SortNode.fromSyntax(sortNode, ctx) : undefined;

		return new InlineQueryNode(from, ctx.span(node), prune, where, sort);
	}
}
