/**
 * Query - Plain class representing a compiled TQL query
 *
 * NOT a Node subclass. This is the clean compilation unit that holds
 * typed clause references and can compile itself into a pipeline.
 *
 * Separates the "what does this query do?" concern from AST parsing.
 */

import type {FromNode} from "./clauses/FromNode";
import type {PruneNode} from "./clauses/PruneNode";
import type {WhereNode} from "./clauses/WhereNode";
import type {WhenNode} from "./clauses/WhenNode";
import type {SortNode} from "./clauses/SortNode";
import type {DisplayNode} from "./clauses/DisplayNode";
import type {GroupNode} from "./clauses/GroupNode";
import type {ValidationContext, QueryResult} from "./types";
import type {QueryEnv} from "./context";
import type {QueryPipeline, QueryTransform} from "./execution/pipeline";
import {executePipeline} from "./execution/pipeline";
import {TraversalSource} from "./execution/sources/traversal-source";
import {WhenGuard} from "./execution/guards/when-guard";
import {WhereTransform} from "./execution/transforms/where-transform";
import {SortTransform} from "./execution/transforms/sort-transform";
import {DisplayTransform} from "./execution/transforms/display-transform";

export class Query {
	readonly group: string;
	readonly groupNode?: GroupNode;
	readonly from: FromNode;
	readonly prune?: PruneNode;
	readonly where?: WhereNode;
	readonly when?: WhenNode;
	readonly sort?: SortNode;
	readonly display?: DisplayNode;

	constructor(options: {
		group: string;
		groupNode?: GroupNode;
		from: FromNode;
		prune?: PruneNode;
		where?: WhereNode;
		when?: WhenNode;
		sort?: SortNode;
		display?: DisplayNode;
	}) {
		this.group = options.group;
		this.groupNode = options.groupNode;
		this.from = options.from;
		this.prune = options.prune;
		this.where = options.where;
		this.when = options.when;
		this.sort = options.sort;
		this.display = options.display;
	}

	/**
	 * Validate the query against the given context.
	 * Returns this for chaining.
	 */
	validate(ctx: ValidationContext): Query {
		this.from.validate(ctx);
		this.prune?.validate(ctx);
		this.where?.validate(ctx);
		this.when?.validate(ctx);
		this.sort?.validate(ctx);
		this.display?.validate(ctx);
		return this;
	}

	/**
	 * Compile this query into an executable pipeline.
	 */
	compile(): QueryPipeline {
		const source = new TraversalSource(this.from, this.prune);

		const transforms: QueryTransform[] = [];
		if (this.where) transforms.push(new WhereTransform(this.where));
		if (this.sort) transforms.push(new SortTransform(this.sort));
		if (this.display) transforms.push(new DisplayTransform(this.display));

		return {
			guard: this.when ? new WhenGuard(this.when) : undefined,
			source,
			transforms,
		};
	}

	/**
	 * Execute the query: compile pipeline and run it.
	 */
	execute(env: QueryEnv): QueryResult {
		const pipeline = this.compile();
		const results = executePipeline(pipeline, env, env.activeFilePath);

		if (results === null) {
			return {
				visible: false,
				results: [],
				warnings: env.getWarnings(),
				errors: env.getErrors(),
			};
		}

		return {
			visible: true,
			results,
			warnings: env.getWarnings(),
			errors: env.hasErrors() ? env.getErrors() : undefined,
		};
	}
}
