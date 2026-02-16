/**
 * WHEN Guard
 *
 * Evaluates the WHEN expression against the active file
 * to decide whether the query should execute at all.
 */

import type {QueryGuard} from "../pipeline";
import type {QueryEnv} from "../../context";
import {evalContextForActiveFile} from "../../context";
import type {WhenNode} from "../../clauses/WhenNode";

export class WhenGuard implements QueryGuard {
	constructor(private readonly when: WhenNode) {}

	shouldExecute(env: QueryEnv): boolean {
		const activeCtx = evalContextForActiveFile(env);
		return this.when.test(activeCtx);
	}
}
