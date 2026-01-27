export type RelationName = string;

export interface RelationAlias {
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

// PropertyValue is recursive to support nested YAML structures
export type PropertyValue = string | number | boolean | string[] | null | PropertyObject;

export interface PropertyObject {
	[key: string]: PropertyValue;
}

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
	/** Optional explicit source (for external edge declarations like [[A]]::rel::[[B]]) */
	source?: string;
	/** If true, target is the current file (for suffix syntax [[A]]::rel where A -> currentFile) */
	targetIsCurrentFile?: boolean;
}

/**
 * A display property with evaluated value
 */
export interface DisplayProperty {
	key: string;
	value: PropertyValue;
}

/**
 * A member within a display group (single file entry)
 */
export interface GroupMember {
	path: string;
	relation: string;
	implied: boolean;
	impliedFrom?: string;
	properties: FileProperties;
	displayProperties: DisplayProperty[];
}

/**
 * A display group containing file members and nested subgroups.
 * Groups are the primary UI structure for rendering relationships.
 */
export interface DisplayGroup {
	/** Context label (e.g., "Dad's parents", "Children") */
	label?: string;
	/** Relation connecting this group to parent context */
	relation: string;
	/** Files directly in this group */
	members: GroupMember[];
	/** Nested subgroups (when members have divergent downstream content) */
	subgroups: DisplayGroup[];
}
