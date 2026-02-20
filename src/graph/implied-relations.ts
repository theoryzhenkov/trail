import { ImpliedDirection, RelationDefinition, RelationEdge } from "../types";

export function applyImpliedRules(
	edges: RelationEdge[],
	relations: RelationDefinition[],
): RelationEdge[] {
	if (relations.length === 0) {
		return edges;
	}

	const impliedEdges: RelationEdge[] = [];
	const existing = new Set(edges.map((edge) => edgeKey(edge)));
	const explicitRoutes = new Set(edges.map((edge) => routeKey(edge)));
	const impliedRules = buildImpliedRules(relations);

	// Apply forward/reverse/both rules (per-edge)
	for (const edge of edges) {
		const rulesForRelation = impliedRules.get(edge.relationUid) ?? [];
		for (const rule of rulesForRelation) {
			if (!rule.baseRelationUid || !rule.impliedRelationUid) {
				continue;
			}

			if (rule.direction === "forward" || rule.direction === "both") {
				const impliedEdge: RelationEdge = {
					fromPath: edge.fromPath,
					toPath: edge.toPath,
					relationUid: rule.impliedRelationUid,
					implied: true,
					impliedFromUid: edge.relationUid,
				};
				addImplied(impliedEdge, impliedEdges, existing, explicitRoutes);
			}

			if (rule.direction === "reverse" || rule.direction === "both") {
				const impliedEdge: RelationEdge = {
					fromPath: edge.toPath,
					toPath: edge.fromPath,
					relationUid: rule.impliedRelationUid,
					implied: true,
					impliedFromUid: edge.relationUid,
				};
				addImplied(impliedEdge, impliedEdges, existing, explicitRoutes);
			}
		}
	}

	// Apply sibling rules (requires finding edges sharing same target)
	applySiblingRules(
		edges,
		impliedRules,
		impliedEdges,
		existing,
		explicitRoutes,
	);

	return [...edges, ...impliedEdges];
}

interface ImpliedRule {
	baseRelationUid: string;
	impliedRelationUid: string;
	direction: ImpliedDirection;
}

function applySiblingRules(
	edges: RelationEdge[],
	impliedRules: Map<string, ImpliedRule[]>,
	impliedEdges: RelationEdge[],
	existing: Set<string>,
	explicitRoutes: Set<string>,
) {
	// Build index: target -> relation -> source edges (for "up"-style siblings)
	// Nodes that share the same target are siblings (e.g., children pointing to same parent)
	const edgesByTargetAndRelation = new Map<
		string,
		Map<string, RelationEdge[]>
	>();

	// Build index: source -> relation -> target edges (for "down"-style siblings)
	// Nodes that share the same source are siblings (e.g., parent pointing to multiple children)
	const edgesBySourceAndRelation = new Map<
		string,
		Map<string, RelationEdge[]>
	>();

	for (const edge of edges) {
		const rulesForRelation = impliedRules.get(edge.relationUid) ?? [];
		const hasSiblingRule = rulesForRelation.some(
			(r) => r.direction === "sibling",
		);
		if (!hasSiblingRule) {
			continue;
		}

		// Index by target (for up-style: multiple sources -> same target)
		let byRelationForTarget = edgesByTargetAndRelation.get(edge.toPath);
		if (!byRelationForTarget) {
			byRelationForTarget = new Map();
			edgesByTargetAndRelation.set(edge.toPath, byRelationForTarget);
		}
		const edgesForTarget = byRelationForTarget.get(edge.relationUid) ?? [];
		edgesForTarget.push(edge);
		byRelationForTarget.set(edge.relationUid, edgesForTarget);

		// Index by source (for down-style: same source -> multiple targets)
		let byRelationForSource = edgesBySourceAndRelation.get(edge.fromPath);
		if (!byRelationForSource) {
			byRelationForSource = new Map();
			edgesBySourceAndRelation.set(edge.fromPath, byRelationForSource);
		}
		const edgesForSource = byRelationForSource.get(edge.relationUid) ?? [];
		edgesForSource.push(edge);
		byRelationForSource.set(edge.relationUid, edgesForSource);
	}

	// Process up-style siblings: nodes that share the same target
	// e.g., Child1 -> Parent (up), Child2 -> Parent (up) => Child1 <-> Child2 (sibling)
	for (const byRelation of edgesByTargetAndRelation.values()) {
		for (const [relation, siblingEdges] of byRelation) {
			if (siblingEdges.length < 2) {
				continue;
			}

			const rulesForRelation = impliedRules.get(relation) ?? [];
			const siblingRules = rulesForRelation.filter(
				(r) => r.direction === "sibling",
			);

			for (const rule of siblingRules) {
				if (!rule.impliedRelationUid) {
					continue;
				}

				// Create edges between all pairs of siblings (sources that share target)
				for (let i = 0; i < siblingEdges.length; i++) {
					const edgeA = siblingEdges[i]!;
					for (let j = i + 1; j < siblingEdges.length; j++) {
						const edgeB = siblingEdges[j]!;

						// Bidirectional: A.from -> B.from and B.from -> A.from
						addImplied(
							{
								fromPath: edgeA.fromPath,
								toPath: edgeB.fromPath,
								relationUid: rule.impliedRelationUid,
								implied: true,
								impliedFromUid: relation,
							},
							impliedEdges,
							existing,
							explicitRoutes,
						);
						addImplied(
							{
								fromPath: edgeB.fromPath,
								toPath: edgeA.fromPath,
								relationUid: rule.impliedRelationUid,
								implied: true,
								impliedFromUid: relation,
							},
							impliedEdges,
							existing,
							explicitRoutes,
						);
					}
				}
			}
		}
	}

	// Process down-style siblings: nodes that share the same source
	// e.g., Parent -> B (down), Parent -> C (down) => B <-> C (sibling)
	for (const byRelation of edgesBySourceAndRelation.values()) {
		for (const [relation, siblingEdges] of byRelation) {
			if (siblingEdges.length < 2) {
				continue;
			}

			const rulesForRelation = impliedRules.get(relation) ?? [];
			const siblingRules = rulesForRelation.filter(
				(r) => r.direction === "sibling",
			);

			for (const rule of siblingRules) {
				if (!rule.impliedRelationUid) {
					continue;
				}

				// Create edges between all pairs of siblings (targets that share source)
				for (let i = 0; i < siblingEdges.length; i++) {
					const edgeA = siblingEdges[i]!;
					for (let j = i + 1; j < siblingEdges.length; j++) {
						const edgeB = siblingEdges[j]!;

						// Bidirectional: A.to -> B.to and B.to -> A.to
						addImplied(
							{
								fromPath: edgeA.toPath,
								toPath: edgeB.toPath,
								relationUid: rule.impliedRelationUid,
								implied: true,
								impliedFromUid: relation,
							},
							impliedEdges,
							existing,
							explicitRoutes,
						);
						addImplied(
							{
								fromPath: edgeB.toPath,
								toPath: edgeA.toPath,
								relationUid: rule.impliedRelationUid,
								implied: true,
								impliedFromUid: relation,
							},
							impliedEdges,
							existing,
							explicitRoutes,
						);
					}
				}
			}
		}
	}
}

function buildImpliedRules(
	relations: RelationDefinition[],
): Map<string, ImpliedRule[]> {
	const map = new Map<string, ImpliedRule[]>();

	for (const relation of relations) {
		if (!relation.uid) {
			continue;
		}
		for (const implied of relation.impliedRelations) {
			if (!implied.targetRelationUid) {
				continue;
			}
			const list = map.get(relation.uid) ?? [];
			list.push({
				baseRelationUid: relation.uid,
				impliedRelationUid: implied.targetRelationUid,
				direction: implied.direction,
			});
			map.set(relation.uid, list);
		}
	}

	return map;
}

function addImplied(
	edge: RelationEdge,
	impliedEdges: RelationEdge[],
	existing: Set<string>,
	explicitRoutes: Set<string>,
) {
	const key = edgeKey(edge);
	if (existing.has(key)) {
		return;
	}
	const route = routeKey(edge);
	if (explicitRoutes.has(route)) {
		return;
	}
	existing.add(key);
	impliedEdges.push(edge);
}

function edgeKey(edge: RelationEdge): string {
	return `${edge.fromPath}|${edge.toPath}|${edge.relationUid}|${edge.label ?? ""}`;
}

function routeKey(edge: RelationEdge): string {
	return `${edge.fromPath}|${edge.toPath}|${edge.relationUid}`;
}
