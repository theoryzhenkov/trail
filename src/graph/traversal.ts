import {RelationEdge} from "../types";

export interface AncestorNode {
	path: string;
	depth: number;
	viaRelation: string;
	implied: boolean;
	impliedFrom?: string;
}

export function computeAncestors(
	startPath: string,
	edges: RelationEdge[],
	relationFilter?: Set<string>
): AncestorNode[] {
	const incomingMap = new Map<string, RelationEdge[]>();
	for (const edge of edges) {
		const list = incomingMap.get(edge.toPath) ?? [];
		list.push(edge);
		incomingMap.set(edge.toPath, list);
	}

	const visited = new Set<string>();
	const queue: Array<{path: string; depth: number}> = [{path: startPath, depth: 0}];
	const results: AncestorNode[] = [];
	visited.add(startPath);

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) {
			break;
		}
		const incomingEdges = incomingMap.get(current.path) ?? [];
		for (const edge of incomingEdges) {
			if (relationFilter && relationFilter.size > 0 && !relationFilter.has(edge.relation)) {
				continue;
			}
			if (visited.has(edge.fromPath)) {
				continue;
			}
			visited.add(edge.fromPath);
			results.push({
				path: edge.fromPath,
				depth: current.depth + 1,
				viaRelation: edge.relation,
				implied: edge.implied,
				impliedFrom: edge.impliedFrom
			});
			queue.push({path: edge.fromPath, depth: current.depth + 1});
		}
	}

	return results;
}
