import type { RelationDefinition, RelationName, RelationUid } from "../types";

// Relation names must start with alphanumeric, can contain _, -
// This prevents "-" alone from being a valid relation (used in chain syntax ::-::)
export const RELATION_NAME_REGEX = /^[a-z0-9][a-z0-9_-]*$/i;

export function normalizeRelationName(name: string): string {
	return name.trim().toLowerCase();
}

export function isValidRelationName(value: string): boolean {
	return value.length > 0 && RELATION_NAME_REGEX.test(value);
}

/** Labels are dot-separated paths where each segment follows relation name rules */
export function isValidLabel(value: string): boolean {
	if (value.length === 0) return false;
	return value.split(".").every((s) => RELATION_NAME_REGEX.test(s));
}

export interface RelationIndexes {
	byUid: Map<RelationUid, RelationDefinition>;
	uidByNormalizedName: Map<string, RelationUid>;
}

export function buildRelationIndexes(
	relations: RelationDefinition[],
): RelationIndexes {
	const byUid = new Map<RelationUid, RelationDefinition>();
	const uidByNormalizedName = new Map<string, RelationUid>();

	for (const relation of relations) {
		byUid.set(relation.uid, relation);
		const normalized = normalizeRelationName(relation.name);
		if (normalized) {
			uidByNormalizedName.set(normalized, relation.uid);
		}
	}

	return { byUid, uidByNormalizedName };
}

export function resolveRelationUidByName(
	relations: RelationDefinition[],
	name: string,
): RelationUid | undefined {
	const normalized = normalizeRelationName(name);
	if (!normalized) {
		return undefined;
	}
	for (const relation of relations) {
		if (normalizeRelationName(relation.name) === normalized) {
			return relation.uid;
		}
	}
	return undefined;
}

export function findRelationByUid(
	relations: RelationDefinition[],
	uid: string,
): RelationDefinition | undefined {
	return relations.find((relation) => relation.uid === uid);
}

export function findRelationByName(
	relations: RelationDefinition[],
	name: string,
): RelationDefinition | undefined {
	const uid = resolveRelationUidByName(relations, name);
	if (!uid) {
		return undefined;
	}
	return findRelationByUid(relations, uid);
}

export function getRelationDisplayName(relation: RelationDefinition): string {
	return relation.name;
}

export function createRelationUid(): RelationUid {
	if (typeof globalThis.crypto?.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}
	const random = Math.random().toString(36).slice(2, 10);
	return `rel_${Date.now()}_${random}`;
}

export function normalizeLabel(label: string): string {
	return label.trim().toLowerCase();
}

export function formatRelationNameForTql(name: RelationName): string {
	return normalizeRelationName(name);
}
