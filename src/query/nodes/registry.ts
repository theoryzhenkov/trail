/**
 * Node Registry
 * 
 * Provides a central registry for all node types.
 * Uses function-based registration instead of decorators for compatibility.
 */

import type {Node} from "./base/Node";
import type {TokenNode} from "./base/TokenNode";
import type {ExprNode} from "./base/ExprNode";

/**
 * Type for a node class constructor
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NodeClass<T extends Node = Node> = new (...args: any[]) => T;

/**
 * Type for a token class constructor
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TokenClass = (new (...args: any[]) => TokenNode) & {
	keyword?: string;
	documentation?: unknown;
	highlighting?: string;
};

/**
 * Registry for all node types
 */
class NodeRegistry {
	private nodesByType = new Map<string, NodeClass>();
	private tokensByKeyword = new Map<string, TokenClass>();
	private exprNodes = new Map<string, NodeClass<ExprNode>>();

	/**
	 * Register a node class by its type identifier
	 */
	register(type: string, cls: NodeClass): void {
		this.nodesByType.set(type, cls);
	}

	/**
	 * Register a token class by its keyword
	 */
	registerToken(keyword: string, cls: TokenClass): void {
		this.tokensByKeyword.set(keyword.toLowerCase(), cls);
	}

	/**
	 * Register an expression node class
	 */
	registerExpr(type: string, cls: NodeClass<ExprNode>): void {
		this.exprNodes.set(type, cls);
		this.nodesByType.set(type, cls);
	}

	/**
	 * Get a node class by type
	 */
	getNodeClass(type: string): NodeClass | undefined {
		return this.nodesByType.get(type);
	}

	/**
	 * Get a token class by keyword
	 */
	getTokenClass(keyword: string): TokenClass | undefined {
		return this.tokensByKeyword.get(keyword.toLowerCase());
	}

	/**
	 * Get an expression node class by type
	 */
	getExprClass(type: string): NodeClass<ExprNode> | undefined {
		return this.exprNodes.get(type);
	}

	/**
	 * Get all registered node classes
	 */
	getAllNodeClasses(): NodeClass[] {
		return Array.from(this.nodesByType.values());
	}

	/**
	 * Get all registered token classes
	 */
	getAllTokenClasses(): TokenClass[] {
		return Array.from(this.tokensByKeyword.values());
	}

	/**
	 * Get all registered expression classes
	 */
	getAllExprClasses(): NodeClass<ExprNode>[] {
		return Array.from(this.exprNodes.values());
	}

	/**
	 * Check if a keyword is registered as a token
	 */
	hasToken(keyword: string): boolean {
		return this.tokensByKeyword.has(keyword.toLowerCase());
	}
}

/**
 * Global node registry instance
 */
export const registry = new NodeRegistry();

/**
 * Register a node class (function-based alternative to decorator)
 */
export function register(
	type: string,
	cls: NodeClass,
	options?: {keyword?: string; expr?: boolean}
): void {
	registry.register(type, cls);

	if (options?.keyword) {
		registry.registerToken(options.keyword, cls as TokenClass);
	}

	if (options?.expr) {
		registry.registerExpr(type, cls as NodeClass<ExprNode>);
	}
}

/**
 * Helper to get node class by type
 */
export function getNodeClass(type: string): NodeClass | undefined {
	return registry.getNodeClass(type);
}

/**
 * Helper to get token class by keyword
 */
export function getTokenClass(keyword: string): TokenClass | undefined {
	return registry.getTokenClass(keyword);
}

/**
 * Helper to get all token classes
 */
export function getAllTokenClasses(): TokenClass[] {
	return registry.getAllTokenClasses();
}

/**
 * Helper to check if keyword is a token
 */
export function isTokenKeyword(keyword: string): boolean {
	return registry.hasToken(keyword);
}
