export type RelationName = string;
export type RelationUid = string;

export interface RelationAlias {
	key: string;
}

export type ImpliedDirection = "forward" | "reverse" | "both" | "sibling";

export interface ImpliedRelation {
	targetRelationUid: RelationUid;
	direction: ImpliedDirection;
}

export type VisualDirection = "descending" | "ascending";

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
	/** Immutable internal identity */
	uid: RelationUid;
	/** User-facing canonical name (case-preserving) */
	name: RelationName;
	aliases: RelationAlias[];
	impliedRelations: ImpliedRelation[];
	visualDirection?: VisualDirection;
	icon?: string;
}

export interface RelationEdge {
	fromPath: string;
	toPath: string;
	relationUid: RelationUid;
	implied: boolean;
	impliedFromUid?: RelationUid;
}

export interface ParsedRelation {
	relation: RelationName;
	/** Target of the edge. undefined = current file */
	target?: string;
	/** Source of the edge. undefined = current file */
	source?: string;
}

/**
 * A display property with evaluated value
 */
export interface DisplayProperty {
	key: string;
	value: PropertyValue;
}

/**
 * A member within a display group (single file entry).
 * A member may be reached via multiple relations (e.g., both "down" and "next"),
 * in which case all relations are listed.
 */
export interface GroupMember {
	path: string;
	relations: string[];
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
	/** Relations connecting this group to parent context */
	relations: string[];
	/** Files directly in this group */
	members: GroupMember[];
	/** Nested subgroups (when members have divergent downstream content) */
	subgroups: DisplayGroup[];
}
