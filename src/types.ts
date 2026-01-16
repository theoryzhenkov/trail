export type RelationName = string;

export type RelationAliasType = "property" | "dotProperty" | "relationsMap";

export interface RelationAlias {
	type: RelationAliasType;
	key: string;
}

export type ImpliedDirection = "forward" | "reverse" | "both";

export interface ImpliedRelation {
	targetRelation: RelationName;
	direction: ImpliedDirection;
}

export interface RelationGroupMember {
	relation: RelationName;
	depth: number;
	extend?: string;
}

export type PropertyValue = string | number | boolean | string[] | null;

export interface FileProperties {
	[key: string]: PropertyValue;
}

export type PropertyFilterOperator = "equals" | "contains" | "exists" | "notExists";

export interface PropertyFilter {
	key: string;
	operator: PropertyFilterOperator;
	value?: string | number | boolean;
}

export interface RelationGroup {
	name: string;
	members: RelationGroupMember[];
	displayProperties?: string[];
	filters?: PropertyFilter[];
	showConditions?: PropertyFilter[];
}

export interface RelationDefinition {
	name: RelationName;
	aliases: RelationAlias[];
	impliedRelations: ImpliedRelation[];
}

export interface RelationEdge {
	fromPath: string;
	toPath: string;
	relation: RelationName;
	implied: boolean;
	impliedFrom?: RelationName;
}

export interface ParsedRelation {
	relation: RelationName;
	target: string;
}
