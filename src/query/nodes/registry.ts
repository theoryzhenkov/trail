/**
 * Node Registry
 *
 * Provides a central registry for all node types.
 * Supports both decorator-based and function-based registration.
 */

import type {Node} from "./base/Node";
import type {TokenNode} from "./base/TokenNode";
import type {ExprNode} from "./base/ExprNode";
import type {BuiltinProperty} from "./base/BuiltinNode";
import type {Completable, CompletionContext, NodeDoc} from "./types";

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
	documentation?: NodeDoc;
	highlighting?: string;
	completable?: Completable;
};

/**
 * Type for a builtin class
 */
export type BuiltinClass = NodeClass & {
	properties?: BuiltinProperty[];
	documentation?: NodeDoc;
};

/**
 * Type for any class with static completion metadata
 */
export interface CompletableClass {
	completable?: Completable;
	documentation?: NodeDoc;
}

/**
 * Registration options
 */
export interface RegisterOptions {
	/** Register as a keyword token */
	keyword?: string;
	/** Register as an expression node */
	expr?: boolean;
	/** Register as a function with this name */
	function?: string;
	/** Register as a clause node */
	clause?: boolean;
	/** Register as a builtin with this name */
	builtin?: string;
}

/**
 * Registry for all node types
 */
class NodeRegistry {
	private nodesByType = new Map<string, NodeClass>();
	private tokensByKeyword = new Map<string, TokenClass>();
	private exprNodes = new Map<string, NodeClass<ExprNode>>();
	private functionsByName = new Map<string, NodeClass<ExprNode>>();
	private completableNodes = new Map<string, CompletableClass>();
	private builtinsByName = new Map<string, BuiltinClass>();
	private clauseNodes = new Map<string, NodeClass>();

	/**
	 * Register a node class by its type identifier
	 */
	register(type: string, cls: NodeClass): void {
		this.nodesByType.set(type, cls);

		// Track if it has completion metadata
		const completable = (cls as unknown as CompletableClass).completable;
		if (completable) {
			this.completableNodes.set(type, cls as unknown as CompletableClass);
		}
	}

	/**
	 * Register a clause node class
	 */
	registerClause(type: string, cls: NodeClass): void {
		this.clauseNodes.set(type, cls);
		this.register(type, cls);
	}

	/**
	 * Register a token class by its keyword
	 */
	registerToken(keyword: string, cls: TokenClass): void {
		this.tokensByKeyword.set(keyword.toLowerCase(), cls);

		// Track if it has completion metadata
		if (cls.completable) {
			this.completableNodes.set(keyword, cls);
		}
	}

	/**
	 * Register an expression node class
	 */
	registerExpr(type: string, cls: NodeClass<ExprNode>): void {
		this.exprNodes.set(type, cls);
		this.nodesByType.set(type, cls);

		// Track if it has completion metadata
		const completable = (cls as unknown as CompletableClass).completable;
		if (completable) {
			this.completableNodes.set(type, cls as unknown as CompletableClass);
		}
	}

	/**
	 * Register a function node class by function name
	 */
	registerFunction(name: string, cls: NodeClass<ExprNode>): void {
		this.functionsByName.set(name.toLowerCase(), cls);
		this.nodesByType.set(cls.name, cls);
		this.exprNodes.set(cls.name, cls);

		// Track if it has completion metadata
		const completable = (cls as unknown as CompletableClass).completable;
		if (completable) {
			this.completableNodes.set(name, cls as unknown as CompletableClass);
		}
	}

	/**
	 * Register a builtin class by builtin name
	 */
	registerBuiltin(name: string, cls: BuiltinClass): void {
		this.builtinsByName.set(name, cls);
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
	 * Get a function node class by function name
	 */
	getFunctionClass(name: string): NodeClass<ExprNode> | undefined {
		return this.functionsByName.get(name.toLowerCase());
	}

	/**
	 * Check if a function is registered
	 */
	hasFunction(name: string): boolean {
		return this.functionsByName.has(name.toLowerCase());
	}

	/**
	 * Get all registered function names
	 */
	getAllFunctionNames(): string[] {
		return Array.from(this.functionsByName.keys());
	}

	/**
	 * Get all registered function classes
	 */
	getAllFunctionClasses(): Map<string, NodeClass<ExprNode>> {
		return new Map(this.functionsByName);
	}

	/**
	 * Get a builtin class by builtin name
	 */
	getBuiltinClass(name: string): BuiltinClass | undefined {
		return this.builtinsByName.get(name);
	}

	/**
	 * Get all builtin classes
	 */
	getAllBuiltinClasses(): Map<string, BuiltinClass> {
		return new Map(this.builtinsByName);
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

	/**
	 * Get all completable nodes for a given context
	 */
	getCompletablesForContext(context: CompletionContext): CompletableClass[] {
		const results: CompletableClass[] = [];

		for (const cls of this.completableNodes.values()) {
			const completable = cls.completable;
			if (!completable) continue;

			const contexts = Array.isArray(completable.context)
				? completable.context
				: [completable.context];

			if (contexts.includes(context)) {
				results.push(cls);
			}
		}

		// Sort by priority (higher first)
		return results.sort((a, b) => (b.completable?.priority ?? 0) - (a.completable?.priority ?? 0));
	}

	/**
	 * Get all completable nodes
	 */
	getAllCompletables(): CompletableClass[] {
		return Array.from(this.completableNodes.values());
	}

	/**
	 * Get all registered clause node types
	 */
	getAllClauseTypes(): string[] {
		return Array.from(this.clauseNodes.keys());
	}

	/**
	 * Get Lezer grammar names for expression clause nodes (clauses that contain expressions).
	 * These are clauses registered with clause: true that have an 'expression' property.
	 * Returns the Lezer grammar name (registry name without "Node" suffix).
	 * 
	 * Expression clauses are identified by having a 'test' method that takes ExecutorContext,
	 * which is unique to PruneNode, WhereNode, and WhenNode.
	 */
	getExpressionClauseLezerNames(): Set<string> {
		const names = new Set<string>();
		for (const [type, cls] of this.clauseNodes) {
			// Expression clauses (PruneNode, WhereNode, WhenNode) have a 'test' method
			// Check if the prototype has a 'test' method
			const prototype = cls.prototype as Record<string, unknown>;
			if (typeof prototype.test === "function") {
				// Convert registry name to Lezer grammar name (remove "Node" suffix)
				const lezerName = type.replace(/Node$/, "");
				names.add(lezerName);
			}
		}
		return names;
	}

	/**
	 * Get Lezer grammar names for expression nodes.
	 * Maps registered expression node types to their Lezer grammar names.
	 */
	getExpressionNodeLezerNames(): Set<string> {
		const names = new Set<string>();
		
		// Map registry types to Lezer grammar names
		// The Lezer grammar uses these names directly for expression nodes
		const lezerExprNames = [
			"OrExpr", "AndExpr", "NotExpr", "CompareExpr", "ArithExpr",
			"ParenExpr", "FunctionCall", "PropertyAccess", "InExpr",
		];
		
		// All of these are valid expression nodes in the Lezer grammar
		for (const name of lezerExprNames) {
			names.add(name);
		}
		
		return names;
	}
}

/**
 * Global node registry instance
 */
export const registry = new NodeRegistry();

/**
 * @register decorator - registers a node class with the registry
 *
 * @example
 * ```typescript
 * @register("LogicalNode", {expr: true})
 * export class LogicalNode extends BinaryNode<ExprNode> {
 *   // ...
 * }
 *
 * @register("ContainsNode", {function: "contains"})
 * export class ContainsNode extends FunctionExprNode {
 *   // ...
 * }
 * ```
 */
export function register(type: string, options?: RegisterOptions) {
	return function <T extends NodeClass>(cls: T): T {
		registry.register(type, cls);

		if (options?.keyword) {
			registry.registerToken(options.keyword, cls as unknown as TokenClass);
		}

		if (options?.expr) {
			registry.registerExpr(type, cls as unknown as NodeClass<ExprNode>);
		}

		if (options?.function) {
			registry.registerFunction(options.function, cls as unknown as NodeClass<ExprNode>);
		}

		if (options?.clause) {
			registry.registerClause(type, cls);
		}

		if (options?.builtin) {
			registry.registerBuiltin(options.builtin, cls as unknown as BuiltinClass);
		}

		return cls;
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

/**
 * Helper to get function class by name
 */
export function getFunctionClass(name: string): NodeClass<ExprNode> | undefined {
	return registry.getFunctionClass(name);
}

/**
 * Helper to check if a function exists
 */
export function hasFunction(name: string): boolean {
	return registry.hasFunction(name);
}

/**
 * Helper to get all function names
 */
export function getAllFunctionNames(): string[] {
	return registry.getAllFunctionNames();
}

/**
 * Helper to get all function classes
 */
export function getAllFunctionClasses(): Map<string, NodeClass<ExprNode>> {
	return registry.getAllFunctionClasses();
}

/**
 * Helper to get builtin class by name
 */
export function getBuiltinClass(name: string): BuiltinClass | undefined {
	return registry.getBuiltinClass(name);
}

/**
 * Helper to get all builtin classes
 */
export function getAllBuiltinClasses(): Map<string, BuiltinClass> {
	return registry.getAllBuiltinClasses();
}

/**
 * Generic helper to get node documentation by type and name
 * This is a convenience wrapper - prefer using docs.ts for documentation access
 */
export function getNodeDoc(type: string, name?: string): NodeDoc | undefined {
	const cls = registry.getNodeClass(type);
	return (cls as unknown as {documentation?: NodeDoc})?.documentation;
}
