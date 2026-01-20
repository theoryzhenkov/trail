/**
 * Test utilities for TQL queries
 * Provides mock data and context for unit testing
 */

import type {RelationEdge, FileProperties, VisualDirection} from "../types";
import type {QueryContext, FileMetadata, QueryResult} from "./nodes/types";
import {QueryNode, parse, createValidationContext} from "./nodes";
import {execute} from "./executor";

/**
 * Mock file data for testing
 */
export interface MockFile {
	path: string;
	properties: FileProperties;
	metadata?: Partial<FileMetadata>;
}

/**
 * Mock edge data for testing
 */
export interface MockEdge {
	from: string;
	to: string;
	relation: string;
	implied?: boolean;
	impliedFrom?: string;
}

/**
 * Mock group for testing extend functionality
 */
export interface MockGroup {
	name: string;
	query: QueryNode;
}

/**
 * Mock graph for testing
 */
export interface MockGraph {
	files: MockFile[];
	edges: MockEdge[];
	relations?: string[];
	groups?: MockGroup[];
}

/**
 * Create a mock QueryContext from test data
 */
export function createMockContext(graph: MockGraph, activeFilePath: string): QueryContext {
	const fileMap = new Map<string, MockFile>();
	for (const file of graph.files) {
		fileMap.set(file.path, file);
	}

	const outgoingEdges = new Map<string, RelationEdge[]>();
	const incomingEdges = new Map<string, RelationEdge[]>();

	for (const edge of graph.edges) {
		// Outgoing
		const outKey = edge.from;
		if (!outgoingEdges.has(outKey)) {
			outgoingEdges.set(outKey, []);
		}
		outgoingEdges.get(outKey)!.push({
			fromPath: edge.from,
			toPath: edge.to,
			relation: edge.relation,
			implied: edge.implied ?? false,
			impliedFrom: edge.impliedFrom,
		});

		// Incoming
		const inKey = edge.to;
		if (!incomingEdges.has(inKey)) {
			incomingEdges.set(inKey, []);
		}
		incomingEdges.get(inKey)!.push({
			fromPath: edge.from,
			toPath: edge.to,
			relation: edge.relation,
			implied: edge.implied ?? false,
			impliedFrom: edge.impliedFrom,
		});
	}

	const activeFile = fileMap.get(activeFilePath);

	return {
		activeFilePath,
		activeFileProperties: activeFile?.properties ?? {},

		getOutgoingEdges(path: string, relation?: string): RelationEdge[] {
			const edges = outgoingEdges.get(path) ?? [];
			if (relation) {
				return edges.filter((e) => e.relation === relation);
			}
			return edges;
		},

		getIncomingEdges(path: string, relation?: string): RelationEdge[] {
			const edges = incomingEdges.get(path) ?? [];
			if (relation) {
				return edges.filter((e) => e.relation === relation);
			}
			return edges;
		},

		getProperties(path: string): FileProperties {
			return fileMap.get(path)?.properties ?? {};
		},

		getFileMetadata(path: string): FileMetadata | undefined {
			const file = fileMap.get(path);
			if (!file) return undefined;

			const name = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
			const folder = path.split("/").slice(0, -1).join("/") || "/";

			return {
				name,
				path,
				folder,
				created: new Date("2024-01-01"),
				modified: new Date("2024-01-01"),
				size: 1000,
				tags: [],
				links: [],
				backlinks: [],
				...file.metadata,
			};
		},

		getRelationNames(): string[] {
			return graph.relations ?? ["up", "down", "next", "prev"];
		},

		getVisualDirection(relation: string): VisualDirection {
			if (relation === "next" || relation === "prev") {
				return "sequential";
			}
			if (relation === "down") {
				return "descending";
			}
			return "ascending";
		},

		getSequentialRelations(): Set<string> {
			const relations = graph.relations ?? ["up", "down", "next", "prev"];
			return new Set(relations.filter((r) => r === "next" || r === "prev"));
		},

		resolveGroupQuery(name: string): QueryNode | undefined {
			const group = graph.groups?.find((g) => g.name === name);
			return group?.query;
		},
	};
}

/**
 * Sample test graphs for common scenarios
 */
export const TestGraphs = {
	/**
	 * Simple hierarchy: A -> B -> C
	 */
	simpleHierarchy(): MockGraph {
		return {
			files: [
				{path: "A.md", properties: {title: "A"}},
				{path: "B.md", properties: {title: "B"}},
				{path: "C.md", properties: {title: "C"}},
			],
			edges: [
				{from: "A.md", to: "B.md", relation: "down"},
				{from: "B.md", to: "A.md", relation: "up"},
				{from: "B.md", to: "C.md", relation: "down"},
				{from: "C.md", to: "B.md", relation: "up"},
			],
		};
	},

	/**
	 * Files with various properties including nulls
	 */
	withProperties(): MockGraph {
		return {
			files: [
				{
					path: "person1.md",
					properties: {name: "Alice", gender: "female", age: 30},
				},
				{
					path: "person2.md",
					properties: {name: "Bob", gender: "male", age: 25},
				},
				{
					path: "person3.md",
					properties: {name: "Charlie", gender: null, age: 35},
				},
				{
					path: "person4.md",
					properties: {name: "Dana", age: 28},
				},
				{
					path: "root.md",
					properties: {title: "Root"},
				},
			],
			edges: [
				{from: "root.md", to: "person1.md", relation: "down"},
				{from: "root.md", to: "person2.md", relation: "down"},
				{from: "root.md", to: "person3.md", relation: "down"},
				{from: "root.md", to: "person4.md", relation: "down"},
				{from: "person1.md", to: "root.md", relation: "up"},
				{from: "person2.md", to: "root.md", relation: "up"},
				{from: "person3.md", to: "root.md", relation: "up"},
				{from: "person4.md", to: "root.md", relation: "up"},
			],
		};
	},

	/**
	 * Sequential chain: A -> B -> C -> D
	 */
	sequentialChain(): MockGraph {
		return {
			files: [
				{path: "chapter1.md", properties: {title: "Chapter 1", order: 1}},
				{path: "chapter2.md", properties: {title: "Chapter 2", order: 2}},
				{path: "chapter3.md", properties: {title: "Chapter 3", order: 3}},
				{path: "chapter4.md", properties: {title: "Chapter 4", order: 4}},
			],
			edges: [
				{from: "chapter1.md", to: "chapter2.md", relation: "next"},
				{from: "chapter2.md", to: "chapter1.md", relation: "prev"},
				{from: "chapter2.md", to: "chapter3.md", relation: "next"},
				{from: "chapter3.md", to: "chapter2.md", relation: "prev"},
				{from: "chapter3.md", to: "chapter4.md", relation: "next"},
				{from: "chapter4.md", to: "chapter3.md", relation: "prev"},
			],
			relations: ["next", "prev"],
		};
	},

	/**
	 * Multi-level hierarchy with filtering scenarios
	 */
	deepHierarchy(): MockGraph {
		return {
			files: [
				{path: "root.md", properties: {level: 0}},
				{path: "a.md", properties: {level: 1, category: "x"}},
				{path: "b.md", properties: {level: 1, category: "y"}},
				{path: "a1.md", properties: {level: 2, category: "x"}},
				{path: "a2.md", properties: {level: 2, category: "x"}},
				{path: "b1.md", properties: {level: 2, category: "y"}},
				{path: "a1i.md", properties: {level: 3, category: "x"}},
			],
			edges: [
				{from: "root.md", to: "a.md", relation: "down"},
				{from: "root.md", to: "b.md", relation: "down"},
				{from: "a.md", to: "root.md", relation: "up"},
				{from: "b.md", to: "root.md", relation: "up"},
				{from: "a.md", to: "a1.md", relation: "down"},
				{from: "a.md", to: "a2.md", relation: "down"},
				{from: "a1.md", to: "a.md", relation: "up"},
				{from: "a2.md", to: "a.md", relation: "up"},
				{from: "b.md", to: "b1.md", relation: "down"},
				{from: "b1.md", to: "b.md", relation: "up"},
				{from: "a1.md", to: "a1i.md", relation: "down"},
				{from: "a1i.md", to: "a1.md", relation: "up"},
			],
		};
	},
};

interface PathNode {
	path: string;
	children: PathNode[];
}

/**
 * Helper to collect all paths from a result tree
 */
export function collectPaths(results: PathNode[]): string[] {
	const paths: string[] = [];

	function visit(nodes: PathNode[]) {
		for (const node of nodes) {
			paths.push(node.path);
			visit(node.children);
		}
	}

	visit(results);
	return paths;
}

/**
 * Helper to run a query and get results
 */
export function runQuery(query: string, graph: MockGraph, activeFile: string): QueryResult {
	const relations = graph.relations ?? ["up", "down", "next", "prev"];
	const groupNames = graph.groups?.map((g) => g.name) ?? [];
	const validationCtx = createValidationContext(relations, groupNames);

	// Parse and validate in one step
	const queryNode = parse(query);
	queryNode.validate(validationCtx);

	const ctx = createMockContext(graph, activeFile);
	return execute(queryNode, ctx);
}

/**
 * Helper to create a validated query for mock groups
 */
export function createMockGroup(
	name: string,
	queryStr: string,
	relations: string[],
	groupNames: string[]
): MockGroup {
	const validationCtx = createValidationContext(relations, groupNames);
	const queryNode = parse(queryStr);
	queryNode.validate(validationCtx);
	return {name, query: queryNode};
}
