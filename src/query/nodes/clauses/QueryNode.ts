/**
 * QueryNode - Root query AST node
 *
 * Thin wrapper around Query that maintains backward compatibility
 * with consumers expecting a Node subclass.
 */

import type {SyntaxNode} from "@lezer/common";
import {ClauseNode} from "../base/ClauseNode";
import {FromNode} from "./FromNode";
import {SortNode} from "./SortNode";
import {DisplayNode} from "./DisplayNode";
import {PruneNode} from "./PruneNode";
import {WhereNode} from "./WhereNode";
import {WhenNode} from "./WhenNode";
import type {
	Span,
	NodeDoc,
	ValidationContext,
	QueryResult,
	CompletionContext,
	Completable,
} from "../types";
import type {QueryEnv} from "../context";
import {Query} from "../query";
import {register, type ConvertContext} from "../registry";
import {getSingleClause} from "../expressions/convert-helpers";

@register("QueryNode", {clause: true})
export class QueryNode extends ClauseNode {
	readonly group: string;
	readonly from: FromNode;
	readonly prune?: PruneNode;
	readonly where?: WhereNode;
	readonly when?: WhenNode;
	readonly sort?: SortNode;
	readonly display?: DisplayNode;

	/** The underlying Query instance */
	private readonly _query: Query;

	static providesContexts: CompletionContext[] = ["clause"];

	static documentation: NodeDoc = {
		title: "TQL Query",
		description: "A complete TQL query with group name, FROM clause, and optional filtering/sorting.",
		syntax: 'group "Name" from ... [prune ...] [where ...] [when ...] [sort ...] [display ...]',
	};

	static completable: Completable = {
		keywords: ["group"],
		context: "query-start",
		priority: 100,
		category: "keyword",
	};

	constructor(
		group: string,
		from: FromNode,
		span: Span,
		prune?: PruneNode,
		where?: WhereNode,
		when?: WhenNode,
		sort?: SortNode,
		display?: DisplayNode
	) {
		super(span);
		this.group = group;
		this.from = from;
		this.prune = prune;
		this.where = where;
		this.when = when;
		this.sort = sort;
		this.display = display;

		this._query = new Query({group, from, prune, where, when, sort, display});
	}

	/**
	 * Get the underlying Query instance
	 */
	toQuery(): Query {
		return this._query;
	}

	/**
	 * Validate the query and return this node for chaining
	 */
	validate(ctx: ValidationContext): QueryNode {
		this._query.validate(ctx);
		return this;
	}

	/**
	 * Execute the query and return results
	 */
	execute(env: QueryEnv): QueryResult {
		return this._query.execute(env);
	}

	static fromSyntax(node: SyntaxNode, ctx: ConvertContext): QueryNode {
		const groupNode = getSingleClause(node, "QueryClause", "Group", "group", true, ctx)!;
		const fromNode = getSingleClause(node, "QueryClause", "From", "from", true, ctx)!;
		const pruneNode = getSingleClause(node, "QueryClause", "Prune", "prune", false, ctx);
		const whereNode = getSingleClause(node, "QueryClause", "Where", "where", false, ctx);
		const whenNode = getSingleClause(node, "QueryClause", "When", "when", false, ctx);
		const sortNode = getSingleClause(node, "QueryClause", "Sort", "sort", false, ctx);
		const displayNode = getSingleClause(node, "QueryClause", "Display", "display", false, ctx);

		// Extract group name
		const stringNode = groupNode.getChild("String");
		if (!stringNode) throw new Error("Missing group name string");
		const group = ctx.parseString(ctx.text(stringNode));

		const from = FromNode.fromSyntax(fromNode, ctx);
		const prune = pruneNode ? PruneNode.fromSyntax(pruneNode, ctx) : undefined;
		const where = whereNode ? WhereNode.fromSyntax(whereNode, ctx) : undefined;
		const when = whenNode ? WhenNode.fromSyntax(whenNode, ctx) : undefined;
		const sort = sortNode ? SortNode.fromSyntax(sortNode, ctx) : undefined;
		const display = displayNode ? DisplayNode.fromSyntax(displayNode, ctx) : undefined;

		return new QueryNode(group, from, ctx.span(node), prune, where, when, sort, display);
	}
}
