/**
 * TQL Query Cache - Caches parsed ASTs and query results
 */

import type {Query} from "./ast";
import type {QueryResult} from "./result";
import {parse} from "./parser";

/**
 * Cached query entry
 */
interface CachedQuery {
	ast: Query;
	timestamp: number;
}

/**
 * Cached result entry
 */
interface CachedResult {
	result: QueryResult;
	filePath: string;
	/** Set of file paths included in this result (for smart invalidation) */
	includedPaths: Set<string>;
	timestamp: number;
}

/**
 * Query cache with LRU eviction
 */
export class QueryCache {
	private astCache: Map<string, CachedQuery>;
	private resultCache: Map<string, CachedResult>;
	private maxAstEntries: number;
	private maxResultEntries: number;
	private resultTtlMs: number;

	constructor(options?: {
		maxAstEntries?: number;
		maxResultEntries?: number;
		resultTtlMs?: number;
	}) {
		this.astCache = new Map();
		this.resultCache = new Map();
		this.maxAstEntries = options?.maxAstEntries ?? 100;
		this.maxResultEntries = options?.maxResultEntries ?? 50;
		this.resultTtlMs = options?.resultTtlMs ?? 5000; // 5 seconds default
	}

	/**
	 * Parse query with caching
	 */
	parseQuery(queryString: string): Query {
		const cached = this.astCache.get(queryString);
		if (cached) {
			// Move to end (LRU)
			this.astCache.delete(queryString);
			this.astCache.set(queryString, cached);
			return cached.ast;
		}

		const ast = parse(queryString);
		this.cacheAst(queryString, ast);
		return ast;
	}

	/**
	 * Get cached result if valid
	 */
	getResult(queryString: string, filePath: string): QueryResult | undefined {
		const key = this.resultKey(queryString, filePath);
		const cached = this.resultCache.get(key);

		if (!cached) {
			return undefined;
		}

		// Check if expired
		const age = Date.now() - cached.timestamp;
		if (age > this.resultTtlMs) {
			this.resultCache.delete(key);
			return undefined;
		}

		// Move to end (LRU)
		this.resultCache.delete(key);
		this.resultCache.set(key, cached);
		return cached.result;
	}

	/**
	 * Cache a query result
	 */
	setResult(queryString: string, filePath: string, result: QueryResult): void {
		const key = this.resultKey(queryString, filePath);
		this.evictResultIfNeeded();
		
		// Collect all file paths in the result for smart invalidation
		const includedPaths = new Set<string>();
		includedPaths.add(filePath);
		this.collectResultPaths(result.results, includedPaths);
		
		this.resultCache.set(key, {
			result,
			filePath,
			includedPaths,
			timestamp: Date.now(),
		});
	}

	/**
	 * Recursively collect file paths from result nodes
	 */
	private collectResultPaths(nodes: QueryResult["results"], paths: Set<string>): void {
		for (const node of nodes) {
			paths.add(node.path);
			this.collectResultPaths(node.children, paths);
		}
	}

	/**
	 * Invalidate results for a specific file
	 * This invalidates any cached result that includes this file (as active or in results)
	 */
	invalidateFile(filePath: string): void {
		for (const [key, entry] of this.resultCache) {
			// Invalidate if this file is the active file OR appears in the result tree
			if (entry.filePath === filePath || entry.includedPaths.has(filePath)) {
				this.resultCache.delete(key);
			}
		}
	}

	/**
	 * Invalidate results for files matching a pattern
	 */
	invalidatePattern(pattern: RegExp): void {
		for (const [key, entry] of this.resultCache) {
			if (pattern.test(entry.filePath)) {
				this.resultCache.delete(key);
			}
		}
	}

	/**
	 * Invalidate all cached results
	 */
	invalidateAllResults(): void {
		this.resultCache.clear();
	}

	/**
	 * Clear entire cache
	 */
	clear(): void {
		this.astCache.clear();
		this.resultCache.clear();
	}

	/**
	 * Get cache statistics
	 */
	getStats(): {astEntries: number; resultEntries: number} {
		return {
			astEntries: this.astCache.size,
			resultEntries: this.resultCache.size,
		};
	}

	private cacheAst(queryString: string, ast: Query): void {
		this.evictAstIfNeeded();
		this.astCache.set(queryString, {
			ast,
			timestamp: Date.now(),
		});
	}

	private evictAstIfNeeded(): void {
		if (this.astCache.size >= this.maxAstEntries) {
			// Remove oldest entry (first in Map)
			const firstKey = this.astCache.keys().next().value;
			if (firstKey) {
				this.astCache.delete(firstKey);
			}
		}
	}

	private evictResultIfNeeded(): void {
		if (this.resultCache.size >= this.maxResultEntries) {
			// Remove oldest entry (first in Map)
			const firstKey = this.resultCache.keys().next().value;
			if (firstKey) {
				this.resultCache.delete(firstKey);
			}
		}
	}

	private resultKey(queryString: string, filePath: string): string {
		return `${filePath}::${queryString}`;
	}
}

/**
 * Global cache instance
 */
let globalCache: QueryCache | null = null;

/**
 * Get the global query cache
 */
export function getCache(): QueryCache {
	if (!globalCache) {
		globalCache = new QueryCache();
	}
	return globalCache;
}

/**
 * Reset the global cache
 */
export function resetCache(): void {
	globalCache = null;
}
