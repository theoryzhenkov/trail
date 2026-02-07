/**
 * QueryNode - Root query node
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
	QueryResultNode,
	DisplayProperty,
	CompletionContext,
	Completable,
} from "../types";
import {type QueryEnv, EvalContext, evalContextFromNode, evalContextForActiveFile} from "../context";
import {executeQueryClauses} from "../execution/query-executor";
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
	}

	/**
	 * Validate the query and return this node for chaining
	 */
	validate(ctx: ValidationContext): QueryNode {
		this.from.validate(ctx);

		if (this.prune) {
			this.prune.validate(ctx);
		}
		if (this.where) {
			this.where.validate(ctx);
		}
		if (this.when) {
			this.when.validate(ctx);
		}
		if (this.sort) {
			this.sort.validate(ctx);
		}
		if (this.display) {
			this.display.validate(ctx);
		}

		return this;
	}

	/**
	 * Execute the query and return results
	 */
	execute(env: QueryEnv): QueryResult {
		// Evaluate WHEN clause against active file
		if (this.when) {
			const activeCtx = evalContextForActiveFile(env);
			if (!this.when.test(activeCtx)) {
				return {
					visible: false,
					results: [],
					warnings: env.getWarnings(),
					errors: env.getErrors(),
				};
			}
		}

		// Execute query clauses using shared logic
		const results = executeQueryClauses(env, {
			from: this.from,
			prune: this.prune,
			where: this.where,
			sort: this.sort,
			startPath: env.activeFilePath,
		});

		// Apply DISPLAY clause (QueryNode-specific)
		const displayed = this.applyDisplay(results, env);

		return {
			visible: true,
			results: displayed,
			warnings: env.getWarnings(),
			errors: env.hasErrors() ? env.getErrors() : undefined,
		};
	}

	/**
	 * Apply DISPLAY clause by evaluating property values for each node.
	 * Constructs a fresh EvalContext per node.
	 */
	private applyDisplay(nodes: QueryResultNode[], env: QueryEnv): QueryResultNode[] {
		if (!this.display) {
			return nodes;
		}

		return nodes.map((node) => {
			const nodeCtx = evalContextFromNode(env, node);

			return {
				...node,
				displayProperties: this.evaluateDisplayProperties(node, nodeCtx),
				children: this.applyDisplay(node.children, env),
			};
		});
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

	/**
	 * Evaluate display properties using PropertyNode.evaluate().
	 */
	private evaluateDisplayProperties(node: QueryResultNode, ctx: EvalContext): DisplayProperty[] {
		if (!this.display) return [];

		const results: DisplayProperty[] = [];

		// Handle "display all" - include all frontmatter properties
		if (this.display.all) {
			for (const [key, value] of Object.entries(node.properties)) {
				// Skip internal prefixes
				if (key.startsWith("file.") || key.startsWith("traversal.")) continue;
				results.push({key, value: value as DisplayProperty["value"]});
			}
		}

		// Evaluate explicit properties using PropertyNode.evaluate()
		for (const prop of this.display.properties) {
			// Determine user-friendly key:
			// - $file.properties.x.y → "x.y" (frontmatter path)
			// - $file.name → "file.name" (keep namespace for metadata)
			// - status → "status" (direct property)
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
