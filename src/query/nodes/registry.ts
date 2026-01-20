/**
 * Node Registry and @register Decorator
 * 
 * Provides a central registry for all node types and a decorator
 * for auto-registration.
 */

import type {Node} from "./base/Node";
import type {TokenNode} from "./base/TokenNode";
import type {ExprNode} from "./base/ExprNode";

/**
 * Type for a node class constructor
 */
export type NodeClass<T extends Node = Node> = {
	new (...args: never[]): T;
	documentation?: unknown;
	highlighting?: string;
	keyword?: string;
};

/**
 * Registry for all node types
 */
class NodeRegistry {
	private nodesByType = new Map<string, NodeClass>();
	private tokensByKeyword = new Map<string, NodeClass<TokenNode>>();
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
	registerToken(keyword: string, cls: NodeClass<TokenNode>): void {
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
	getTokenClass(keyword: string): NodeClass<TokenNode> | undefined {
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
	getAllTokenClasses(): NodeClass<TokenNode>[] {
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
 * @register decorator for node classes
 * 
 * Usage:
 *   @register('logical')
 *   export class LogicalNode extends BinaryNode { ... }
 * 
 * For tokens with keywords:
 *   @register('And', { keyword: 'and' })
 *   export class AndToken extends TokenNode { ... }
 */
export function register(
	type: string,
	options?: {keyword?: string; expr?: boolean}
): ClassDecorator {
	return function <T extends NodeClass>(target: T): T {
		registry.register(type, target);

		if (options?.keyword) {
			registry.registerToken(options.keyword, target as NodeClass<TokenNode>);
		}

		if (options?.expr) {
			registry.registerExpr(type, target as NodeClass<ExprNode>);
		}

		return target;
	};
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
export function getTokenClass(keyword: string): NodeClass<TokenNode> | undefined {
	return registry.getTokenClass(keyword);
}

/**
 * Helper to get all token classes
 */
export function getAllTokenClasses(): NodeClass<TokenNode>[] {
	return registry.getAllTokenClasses();
}

/**
 * Helper to check if keyword is a token
 */
export function isTokenKeyword(keyword: string): boolean {
	return registry.hasToken(keyword);
}
