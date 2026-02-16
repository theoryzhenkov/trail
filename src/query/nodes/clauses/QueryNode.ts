/**
 * QueryNode - Root query AST node
 *
 * Thin wrapper around Query that maintains backward compatibility
 * with consumers expecting a Node subclass.
 */

import type {SyntaxNode} from "@lezer/common";
import {Node} from "../base/Node";
import {FromNode} from "./FromNode";
import {GroupNode} from "./GroupNode";
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
export class QueryNode extends Node {
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

		this._query = new Query({group, groupNode: undefined, from, prune, where, when, sort, display});
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
		const groupSyntax = getSingleClause(node, "QueryClause", "Group", "group", true, ctx)!;
		const fromSyntax = getSingleClause(node, "QueryClause", "From", "from", true, ctx)!;
		const pruneSyntax = getSingleClause(node, "QueryClause", "Prune", "prune", false, ctx);
		const whereSyntax = getSingleClause(node, "QueryClause", "Where", "where", false, ctx);
		const whenSyntax = getSingleClause(node, "QueryClause", "When", "when", false, ctx);
		const sortSyntax = getSingleClause(node, "QueryClause", "Sort", "sort", false, ctx);
		const displaySyntax = getSingleClause(node, "QueryClause", "Display", "display", false, ctx);

		const groupNode = GroupNode.fromSyntax(groupSyntax, ctx);
		const from = FromNode.fromSyntax(fromSyntax, ctx);
		const prune = pruneSyntax ? PruneNode.fromSyntax(pruneSyntax, ctx) : undefined;
		const where = whereSyntax ? WhereNode.fromSyntax(whereSyntax, ctx) : undefined;
		const when = whenSyntax ? WhenNode.fromSyntax(whenSyntax, ctx) : undefined;
		const sort = sortSyntax ? SortNode.fromSyntax(sortSyntax, ctx) : undefined;
		const display = displaySyntax ? DisplayNode.fromSyntax(displaySyntax, ctx) : undefined;

		return new QueryNode(groupNode.name, from, ctx.span(node), prune, where, when, sort, display);
	}
}
