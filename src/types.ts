export type RelationName = string;

export type RelationAliasType = "property" | "dotProperty" | "relationsMap";

export interface RelationAlias {
	type: RelationAliasType;
	key: string;
}

export type ImpliedDirection = "forward" | "reverse" | "both" | "sibling";

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

export type SortDirection = "asc" | "desc";

export interface PropertySortKey {
	property: string;
	direction: SortDirection;
}

export type ChainSortMode = "disabled" | "primary" | "secondary";

export interface RelationGroup {
	name: string;
	members: RelationGroupMember[];
	displayProperties?: string[];
	filters?: PropertyFilter[];
	filtersMatchMode?: FilterMatchMode;
	showConditions?: PropertyFilter[];
	showConditionsMatchMode?: FilterMatchMode;
	sortBy?: PropertySortKey[];
	chainSort?: ChainSortMode;
}

/**
 * TQL-based group definition
 */
export interface GroupDefinition {
	/** TQL query string (authoritative source) */
	query: string;
	/** Override name from query (optional) */
	name?: string;
	/** Whether group is enabled (default: true) */
	enabled?: boolean;
	/** Display options */
	displayOptions?: {
		collapsed?: boolean;
		iconColor?: string;
	};
}

export interface RelationDefinition {
	name: RelationName;
	aliases: RelationAlias[];
	impliedRelations: ImpliedRelation[];
	visualDirection?: VisualDirection;
	icon?: string;
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
