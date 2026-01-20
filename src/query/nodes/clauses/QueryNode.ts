/**
 * QueryNode - Root query node
 */

import {ClauseNode} from "../base/ClauseNode";
import {FromNode} from "./FromNode";
import {SortNode} from "./SortNode";
import {DisplayNode} from "./DisplayNode";
import {ExprNode} from "../base/ExprNode";
import type {Span, NodeDoc, ValidationContext, QueryResult, QueryResultNode} from "../types";
import type {ExecutorContext} from "../context";

export class QueryNode extends ClauseNode {
	readonly group: string;
	readonly from: FromNode;
	readonly prune?: ExprNode;
	readonly where?: ExprNode;
	readonly when?: ExprNode;
	readonly sort?: SortNode;
	readonly display?: DisplayNode;

	static documentation: NodeDoc = {
		title: "TQL Query",
		description: "A complete TQL query with group name, FROM clause, and optional filtering/sorting.",
		syntax: 'group "Name" from ... [prune ...] [where ...] [when ...] [sort by ...] [display ...]',
	};

	constructor(
		group: string,
		from: FromNode,
		span: Span,
		prune?: ExprNode,
		where?: ExprNode,
		when?: ExprNode,
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
			const whenResult = this.when.evaluate(ctx);
			if (!ctx.isTruthy(whenResult)) {
				return {
					visible: false,
					results: [],
					warnings: ctx.getWarnings(),
					errors: ctx.getErrors(),
				};
			}
		}

		// Traverse FROM clause
		const results = this.traverse(ctx);

		// Apply WHERE filter
		const filtered = this.where ? this.applyWhereFilter(results, ctx) : results;

		// Sort results
		const sorted = this.sort ? this.sortResults(filtered, ctx) : filtered;

		// Apply DISPLAY clause
		const displayed = this.applyDisplay(sorted);

		return {
			visible: true,
			results: displayed,
			warnings: ctx.getWarnings(),
			errors: ctx.hasErrors() ? ctx.getErrors() : undefined,
		};
	}

	private traverse(_ctx: ExecutorContext): QueryResultNode[] {
		// Placeholder - traversal logic to be implemented
		// This would traverse the graph based on FROM clause relations
		// Full implementation will be added during executor refactor
		return [];
	}

	private applyWhereFilter(nodes: QueryResultNode[], ctx: ExecutorContext): QueryResultNode[] {
		// Filter nodes based on WHERE clause
		const result: QueryResultNode[] = [];

		for (const node of nodes) {
			ctx.setCurrentFile(node.path, node.properties);
			ctx.setTraversal({
				depth: node.depth,
				relation: node.relation,
				isImplied: node.implied,
				parent: node.parent,
				path: node.traversalPath,
			});

			const whereResult = this.where!.evaluate(ctx);
			const filteredChildren = this.applyWhereFilter(node.children, ctx);

			if (ctx.isTruthy(whereResult)) {
				result.push({...node, children: filteredChildren});
			} else if (filteredChildren.length > 0) {
				result.push(
					...filteredChildren.map((child) => ({...child, hasFilteredAncestor: true}))
				);
			}
		}

		return result;
	}

	private sortResults(nodes: QueryResultNode[], _ctx: ExecutorContext): QueryResultNode[] {
		// Sort nodes based on SORT clause
		// Full implementation to be added during executor refactor
		return nodes;
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
			const explicit = this.display.properties.map((p) => p.path.join("."));
			return [...new Set([...allProps, ...explicit])];
		}

		return this.display.properties.map((p) => p.path.join("."));
	}
}
