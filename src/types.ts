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

export type VisualDirection = "descending" | "ascending" | "sequential";

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
export type FilterMatchMode = "all" | "any";

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
	filtersMatchMode?: FilterMatchMode;
	showConditions?: PropertyFilter[];
	showConditionsMatchMode?: FilterMatchMode;
}

export interface RelationDefinition {
	name: RelationName;
	aliases: RelationAlias[];
	impliedRelations: ImpliedRelation[];
	visualDirection?: VisualDirection;
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
