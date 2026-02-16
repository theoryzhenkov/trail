/**
 * Test utilities for TQL queries
 * Provides mock data and context for unit testing
 */

import type {RelationEdge, FileProperties, VisualDirection} from "../types";
import type {QueryContext, FileMetadata, QueryResult} from "./nodes/types";
import {Query, parse, createValidationContext} from "./nodes";
import {execute} from "./executor";
import {normalizeRelationName} from "../relations";

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
	relationUid?: string;
	relation?: string;
	implied?: boolean;
	impliedFromUid?: string;
	impliedFrom?: string;
}

/**
 * Mock group for testing extend functionality
 */
export interface MockGroup {
	name: string;
	query: Query;
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
		const relationUid = edge.relationUid ?? edge.relation ?? "";
		const impliedFromUid = edge.impliedFromUid ?? edge.impliedFrom;
		if (!relationUid) {
			continue;
		}
		// Outgoing
		const outKey = edge.from;
		if (!outgoingEdges.has(outKey)) {
			outgoingEdges.set(outKey, []);
		}
		outgoingEdges.get(outKey)!.push({
			fromPath: edge.from,
			toPath: edge.to,
			relationUid,
			implied: edge.implied ?? false,
			impliedFromUid,
		});

		// Incoming
		const inKey = edge.to;
		if (!incomingEdges.has(inKey)) {
			incomingEdges.set(inKey, []);
		}
		incomingEdges.get(inKey)!.push({
			fromPath: edge.from,
			toPath: edge.to,
			relationUid,
			implied: edge.implied ?? false,
			impliedFromUid,
		});
	}

	const relationNames = graph.relations ?? ["up", "down", "next", "prev"];
	const relationNameByUid = new Map<string, string>();
	const relationUidByName = new Map<string, string>();
	for (const relationName of relationNames) {
		relationNameByUid.set(relationName, relationName);
		relationUidByName.set(normalizeRelationName(relationName), relationName);
	}

	const activeFile = fileMap.get(activeFilePath);

	return {
		activeFilePath,
		activeFileProperties: activeFile?.properties ?? {},

		getOutgoingEdges(path: string, relation?: string): RelationEdge[] {
			const edges = outgoingEdges.get(path) ?? [];
			if (relation) {
				return edges.filter((e) => e.relationUid === relation);
			}
			return edges;
		},

		getIncomingEdges(path: string, relation?: string): RelationEdge[] {
			const edges = incomingEdges.get(path) ?? [];
			if (relation) {
				return edges.filter((e) => e.relationUid === relation);
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
			return relationNames;
		},

		resolveRelationUid(name: string): string | undefined {
			if (relationNameByUid.has(name)) {
				return name;
			}
			return relationUidByName.get(normalizeRelationName(name));
		},

		getRelationName(uid: string): string {
			return relationNameByUid.get(uid) ?? uid;
		},

		getVisualDirection(relationUid: string): VisualDirection {
			const relation = relationNameByUid.get(relationUid) ?? relationUid;
			if (relation === "down" || relation === "next") {
				return "descending";
			}
			return "ascending";
		},

		resolveGroupQuery(name: string): Query | undefined {
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
				{from: "A.md", to: "B.md", relationUid: "down"},
				{from: "B.md", to: "A.md", relationUid: "up"},
				{from: "B.md", to: "C.md", relationUid: "down"},
				{from: "C.md", to: "B.md", relationUid: "up"},
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
				{from: "root.md", to: "person1.md", relationUid: "down"},
				{from: "root.md", to: "person2.md", relationUid: "down"},
				{from: "root.md", to: "person3.md", relationUid: "down"},
				{from: "root.md", to: "person4.md", relationUid: "down"},
				{from: "person1.md", to: "root.md", relationUid: "up"},
				{from: "person2.md", to: "root.md", relationUid: "up"},
				{from: "person3.md", to: "root.md", relationUid: "up"},
				{from: "person4.md", to: "root.md", relationUid: "up"},
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
				{from: "chapter1.md", to: "chapter2.md", relationUid: "next"},
				{from: "chapter2.md", to: "chapter1.md", relationUid: "prev"},
				{from: "chapter2.md", to: "chapter3.md", relationUid: "next"},
				{from: "chapter3.md", to: "chapter2.md", relationUid: "prev"},
				{from: "chapter3.md", to: "chapter4.md", relationUid: "next"},
				{from: "chapter4.md", to: "chapter3.md", relationUid: "prev"},
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
				{from: "root.md", to: "a.md", relationUid: "down"},
				{from: "root.md", to: "b.md", relationUid: "down"},
				{from: "a.md", to: "root.md", relationUid: "up"},
				{from: "b.md", to: "root.md", relationUid: "up"},
				{from: "a.md", to: "a1.md", relationUid: "down"},
				{from: "a.md", to: "a2.md", relationUid: "down"},
				{from: "a1.md", to: "a.md", relationUid: "up"},
				{from: "a2.md", to: "a.md", relationUid: "up"},
				{from: "b.md", to: "b1.md", relationUid: "down"},
				{from: "b1.md", to: "b.md", relationUid: "up"},
				{from: "a1.md", to: "a1i.md", relationUid: "down"},
				{from: "a1i.md", to: "a1.md", relationUid: "up"},
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
	const q = parse(query);
	q.validate(validationCtx);

	const ctx = createMockContext(graph, activeFile);
	return execute(q, ctx);
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
	const q = parse(queryStr);
	q.validate(validationCtx);
	return {name, query: q};
}
