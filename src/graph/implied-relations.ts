import {ImpliedDirection, RelationDefinition, RelationEdge} from "../types";

export function applyImpliedRules(edges: RelationEdge[], relations: RelationDefinition[]): RelationEdge[] {
	if (relations.length === 0) {
		return edges;
	}

	const impliedEdges: RelationEdge[] = [];
	const existing = new Set(edges.map((edge) => edgeKey(edge)));
	const impliedRules = buildImpliedRules(relations);

	// Apply forward/reverse/both rules (per-edge)
	for (const edge of edges) {
		const rulesForRelation = impliedRules.get(edge.relation) ?? [];
		for (const rule of rulesForRelation) {
			const baseRelation = rule.baseRelation.trim().toLowerCase();
			const impliedRelation = rule.impliedRelation.trim().toLowerCase();
			if (!baseRelation || !impliedRelation) {
				continue;
			}

			if (rule.direction === "forward" || rule.direction === "both") {
				const impliedEdge: RelationEdge = {
					fromPath: edge.fromPath,
					toPath: edge.toPath,
					relation: impliedRelation,
					implied: true,
					impliedFrom: edge.relation
				};
				addImplied(impliedEdge, impliedEdges, existing);
			}

			if (rule.direction === "reverse" || rule.direction === "both") {
				const impliedEdge: RelationEdge = {
					fromPath: edge.toPath,
					toPath: edge.fromPath,
					relation: impliedRelation,
					implied: true,
					impliedFrom: edge.relation
				};
				addImplied(impliedEdge, impliedEdges, existing);
			}
		}
	}

	// Apply sibling rules (requires finding edges sharing same target)
	applySiblingRules(edges, impliedRules, impliedEdges, existing);

	return [...edges, ...impliedEdges];
}

interface ImpliedRule {
	baseRelation: string;
	impliedRelation: string;
	direction: ImpliedDirection;
}

function applySiblingRules(
	edges: RelationEdge[],
	impliedRules: Map<string, ImpliedRule[]>,
	impliedEdges: RelationEdge[],
	existing: Set<string>
) {
	// Build index: target -> relation -> source edges (for "up"-style siblings)
	// Nodes that share the same target are siblings (e.g., children pointing to same parent)
	const edgesByTargetAndRelation = new Map<string, Map<string, RelationEdge[]>>();

	// Build index: source -> relation -> target edges (for "down"-style siblings)
	// Nodes that share the same source are siblings (e.g., parent pointing to multiple children)
	const edgesBySourceAndRelation = new Map<string, Map<string, RelationEdge[]>>();

	for (const edge of edges) {
		const rulesForRelation = impliedRules.get(edge.relation) ?? [];
		const hasSiblingRule = rulesForRelation.some((r) => r.direction === "sibling");
		if (!hasSiblingRule) {
			continue;
		}

		// Index by target (for up-style: multiple sources -> same target)
		let byRelationForTarget = edgesByTargetAndRelation.get(edge.toPath);
		if (!byRelationForTarget) {
			byRelationForTarget = new Map();
			edgesByTargetAndRelation.set(edge.toPath, byRelationForTarget);
		}
		const edgesForTarget = byRelationForTarget.get(edge.relation) ?? [];
		edgesForTarget.push(edge);
		byRelationForTarget.set(edge.relation, edgesForTarget);

		// Index by source (for down-style: same source -> multiple targets)
		let byRelationForSource = edgesBySourceAndRelation.get(edge.fromPath);
		if (!byRelationForSource) {
			byRelationForSource = new Map();
			edgesBySourceAndRelation.set(edge.fromPath, byRelationForSource);
		}
		const edgesForSource = byRelationForSource.get(edge.relation) ?? [];
		edgesForSource.push(edge);
		byRelationForSource.set(edge.relation, edgesForSource);
	}

	// Process up-style siblings: nodes that share the same target
	// e.g., Child1 -> Parent (up), Child2 -> Parent (up) => Child1 <-> Child2 (sibling)
	for (const byRelation of edgesByTargetAndRelation.values()) {
		for (const [relation, siblingEdges] of byRelation) {
			if (siblingEdges.length < 2) {
				continue;
			}

			const rulesForRelation = impliedRules.get(relation) ?? [];
			const siblingRules = rulesForRelation.filter((r) => r.direction === "sibling");

			for (const rule of siblingRules) {
				const impliedRelation = rule.impliedRelation.trim().toLowerCase();
				if (!impliedRelation) {
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
								relation: impliedRelation,
								implied: true,
								impliedFrom: relation
							},
							impliedEdges,
							existing
						);
						addImplied(
							{
								fromPath: edgeB.fromPath,
								toPath: edgeA.fromPath,
								relation: impliedRelation,
								implied: true,
								impliedFrom: relation
							},
							impliedEdges,
							existing
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
			const siblingRules = rulesForRelation.filter((r) => r.direction === "sibling");

			for (const rule of siblingRules) {
				const impliedRelation = rule.impliedRelation.trim().toLowerCase();
				if (!impliedRelation) {
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
								relation: impliedRelation,
								implied: true,
								impliedFrom: relation
							},
							impliedEdges,
							existing
						);
						addImplied(
							{
								fromPath: edgeB.toPath,
								toPath: edgeA.toPath,
								relation: impliedRelation,
								implied: true,
								impliedFrom: relation
							},
							impliedEdges,
							existing
						);
					}
				}
			}
		}
	}
}

function buildImpliedRules(relations: RelationDefinition[]): Map<string, ImpliedRule[]> {
	const map = new Map<string, ImpliedRule[]>();

	for (const relation of relations) {
		const baseRelation = relation.name.trim().toLowerCase();
		if (!baseRelation) {
			continue;
		}
		for (const implied of relation.impliedRelations) {
			const impliedRelation = implied.targetRelation.trim().toLowerCase();
			if (!impliedRelation) {
				continue;
			}
			const list = map.get(baseRelation) ?? [];
			list.push({
				baseRelation,
				impliedRelation,
				direction: implied.direction
			});
			map.set(baseRelation, list);
		}
	}

	return map;
}

function addImplied(edge: RelationEdge, impliedEdges: RelationEdge[], existing: Set<string>) {
	const key = edgeKey(edge);
	if (existing.has(key)) {
		return;
	}
	existing.add(key);
	impliedEdges.push(edge);
}

function edgeKey(edge: RelationEdge): string {
	return `${edge.fromPath}|${edge.toPath}|${edge.relation}`;
}
