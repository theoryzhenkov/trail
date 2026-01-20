/**
 * QueryNode - Root query node
 */

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
	CompletionContext,
	Completable,
} from "../types";
import type {ExecutorContext} from "../context";
import {executeQueryClauses} from "../execution/query-executor";
import {register} from "../registry";

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
	execute(ctx: ExecutorContext): QueryResult {
		// Evaluate WHEN clause against active file
		if (this.when) {
			ctx.setCurrentFile(ctx.activeFilePath, ctx.activeFileProperties);
			if (!this.when.test(ctx)) {
				return {
					visible: false,
					results: [],
					warnings: ctx.getWarnings(),
					errors: ctx.getErrors(),
				};
			}
		}

		// Execute query clauses using shared logic
		const results = executeQueryClauses(ctx, {
			from: this.from,
			prune: this.prune,
			where: this.where,
			sort: this.sort,
			startPath: ctx.activeFilePath,
		});

		// Apply DISPLAY clause (QueryNode-specific)
		const displayed = this.applyDisplay(results);

		return {
			visible: true,
			results: displayed,
			warnings: ctx.getWarnings(),
			errors: ctx.hasErrors() ? ctx.getErrors() : undefined,
		};
	}

	private applyDisplay(nodes: QueryResultNode[]): QueryResultNode[] {
		if (!this.display) {
			return nodes;
		}

		return nodes.map((node) => ({
			...node,
			displayProperties: this.getDisplayProperties(node),
			children: this.applyDisplay(node.children),
		}));
	}

	private getDisplayProperties(node: QueryResultNode): string[] {
		if (!this.display) return [];

		if (this.display.all) {
			const allProps = Object.keys(node.properties).filter(
				(k) => !k.startsWith("file.") && !k.startsWith("traversal.")
			);
			// Use getFrontmatterPath for proper handling of $file.properties.* syntax
			const explicit = this.display.properties
				.map((p) => p.getFrontmatterPath())
				.filter((p): p is string => p !== null);
			return [...new Set([...allProps, ...explicit])];
		}

		// Use getFrontmatterPath for proper handling of $file.properties.* syntax
		return this.display.properties
			.map((p) => p.getFrontmatterPath())
			.filter((p): p is string => p !== null);
	}
}
