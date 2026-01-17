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
	// Build index: target -> relation -> source edges
	const edgesByTargetAndRelation = new Map<string, Map<string, RelationEdge[]>>();

	for (const edge of edges) {
		const rulesForRelation = impliedRules.get(edge.relation) ?? [];
		const hasSiblingRule = rulesForRelation.some((r) => r.direction === "sibling");
		if (!hasSiblingRule) {
			continue;
		}

		let byRelation = edgesByTargetAndRelation.get(edge.toPath);
		if (!byRelation) {
			byRelation = new Map();
			edgesByTargetAndRelation.set(edge.toPath, byRelation);
		}

		const edgesForRelation = byRelation.get(edge.relation) ?? [];
		edgesForRelation.push(edge);
		byRelation.set(edge.relation, edgesForRelation);
	}

	// For each target with multiple sources via same relation, create sibling edges
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

				// Create edges between all pairs of siblings
				for (let i = 0; i < siblingEdges.length; i++) {
					const edgeA = siblingEdges[i]!;
					for (let j = i + 1; j < siblingEdges.length; j++) {
						const edgeB = siblingEdges[j]!;

						// Bidirectional: A -> B and B -> A
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
