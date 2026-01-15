export type RelationName = string;

export interface RelationEdge {
	fromPath: string;
	toPath: string;
	relation: RelationName;
	implied: boolean;
	impliedFrom?: RelationName;
}

export type ImpliedDirection = "forward" | "reverse" | "both";

export interface ImpliedRule {
	baseRelation: RelationName;
	impliedRelation: RelationName;
	direction: ImpliedDirection;
}

export interface ParsedRelation {
	relation: RelationName;
	target: string;
}
