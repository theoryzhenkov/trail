import {App, TFile} from "obsidian";
import {TrailSettings} from "../settings";
import {
	FileProperties,
	FilterMatchMode,
	PropertyFilter,
	RelationEdge,
	RelationGroup,
	VisualDirection
} from "../types";
import {parseInlineRelations} from "../parsing/inline";
import {parseFileProperties, parseFrontmatterRelations} from "../parsing/frontmatter";
import {computeAncestors, AncestorNode} from "./traversal";
import {applyImpliedRules} from "./implied-relations";
import {buildPropertyExcludeKeys, evaluatePropertyFilter} from "./property-filters";
import {sortSiblingsRecursively, SortConfig} from "./sibling-sort";

export interface GroupTreeNode {
	path: string;
	relation: string;
	depth: number;
	implied: boolean;
	impliedFrom?: string;
	children: GroupTreeNode[];
	properties?: FileProperties;
	visualDirection: VisualDirection;
}

export class GraphStore {
	private app: App;
	private settings: TrailSettings;
	private edgesBySource: Map<string, RelationEdge[]>;
	private propertiesByPath: Map<string, FileProperties>;
	private staleFiles: Set<string>;
	private allStale: boolean;
	private changeListeners: Set<() => void>;

	constructor(app: App, settings: TrailSettings) {
		this.app = app;
		this.settings = settings;
		this.edgesBySource = new Map();
		this.propertiesByPath = new Map();
		this.staleFiles = new Set();
		this.allStale = true;
		this.changeListeners = new Set();
	}

	onDidChange(callback: () => void) {
		this.changeListeners.add(callback);
		return () => {
			this.changeListeners.delete(callback);
		};
	}

	updateSettings(settings: TrailSettings) {
		this.settings = settings;
	}

	async build() {
		this.edgesBySource.clear();
		this.propertiesByPath.clear();
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			await this.updateFile(file, false);
		}
		this.staleFiles.clear();
		this.allStale = false;
		this.emitChange();
	}

	async updateFile(file: TFile, emit = true) {
		const {edges, properties} = await this.parseFileData(file);
		this.edgesBySource.set(file.path, edges);
		this.propertiesByPath.set(file.path, properties);
		if (emit) {
			this.emitChange();
		}
	}

	markFileStale(path: string) {
		this.staleFiles.add(path);
	}

	markAllStale() {
		this.allStale = true;
		this.staleFiles.clear();
	}

	async ensureFresh() {
		if (this.allStale) {
			await this.build();
			return;
		}

		if (this.staleFiles.size === 0) {
			return;
		}

		const filesToUpdate = Array.from(this.staleFiles);
		this.staleFiles.clear();
		for (const path of filesToUpdate) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await this.updateFile(file, false);
			} else {
				this.edgesBySource.delete(path);
				this.propertiesByPath.delete(path);
			}
		}
		this.emitChange();
	}

	handleRename(oldPath: string, newPath: string) {
		const edges = this.edgesBySource.get(oldPath);
		if (edges) {
			const updatedEdges = edges.map((edge) => ({
				...edge,
				fromPath: newPath
			}));
			this.edgesBySource.set(newPath, updatedEdges);
			this.edgesBySource.delete(oldPath);
		}
		const properties = this.propertiesByPath.get(oldPath);
		if (properties) {
			this.propertiesByPath.set(newPath, properties);
			this.propertiesByPath.delete(oldPath);
		}

		for (const [source, list] of this.edgesBySource.entries()) {
			let changed = false;
			const updated = list.map((edge) => {
				if (edge.toPath === oldPath) {
					changed = true;
					return {...edge, toPath: newPath};
				}
				return edge;
			});
			if (changed) {
				this.edgesBySource.set(source, updated);
			}
		}

		if (this.staleFiles.has(oldPath)) {
			this.staleFiles.delete(oldPath);
			this.staleFiles.add(newPath);
		}
		this.emitChange();
	}

	handleDelete(path: string) {
		this.edgesBySource.delete(path);
		this.propertiesByPath.delete(path);
		for (const [source, list] of this.edgesBySource.entries()) {
			const filtered = list.filter((edge) => edge.toPath !== path);
			if (filtered.length !== list.length) {
				this.edgesBySource.set(source, filtered);
			}
		}
		this.staleFiles.delete(path);
		this.emitChange();
	}

	private emitChange() {
		for (const listener of this.changeListeners) {
			listener();
		}
	}

	getRelationTypes(): string[] {
		const types = new Set<string>();
		for (const relation of this.settings.relations) {
			if (relation.name) {
				types.add(relation.name);
			}
		}
		for (const edge of this.getEdgesWithImplied()) {
			types.add(edge.relation);
		}
		return Array.from(types).sort();
	}

	getIncomingEdges(path: string, relationFilter?: Set<string>): RelationEdge[] {
		return this.getEdgesWithImplied().filter((edge) => {
			if (edge.toPath !== path) {
				return false;
			}
			if (!relationFilter || relationFilter.size === 0) {
				return true;
			}
			return relationFilter.has(edge.relation);
		});
	}

	getOutgoingEdges(path: string, relationFilter?: Set<string>): RelationEdge[] {
		return this.getEdgesWithImplied().filter((edge) => {
			if (edge.fromPath !== path) {
				return false;
			}
			if (!relationFilter || relationFilter.size === 0) {
				return true;
			}
			return relationFilter.has(edge.relation);
		});
	}

	getAncestors(path: string, relationFilter?: Set<string>): AncestorNode[] {
		return computeAncestors(path, this.getEdgesWithImplied(), relationFilter);
	}

	getGroupTree(path: string, group: RelationGroup): GroupTreeNode[] {
		const edgesBySource = this.buildEdgesBySource();
		const visited = new Set<string>();
		visited.add(path);
		return this.evaluateGroup(path, group, edgesBySource, visited);
	}

	matchesFilters(path: string, filters: PropertyFilter[], matchMode: FilterMatchMode = "all"): boolean {
		if (filters.length === 0) {
			return true;
		}
		const properties = this.propertiesByPath.get(path) ?? {};
		if (matchMode === "any") {
			return filters.some((filter) => evaluatePropertyFilter(properties, filter));
		}
		return filters.every((filter) => evaluatePropertyFilter(properties, filter));
	}

	private evaluateGroup(
		sourcePath: string,
		group: RelationGroup,
		edgesBySource: Map<string, RelationEdge[]>,
		visited: Set<string>
	): GroupTreeNode[] {
		const nodes: GroupTreeNode[] = [];
		for (const member of group.members) {
			if (!member.relation) {
				continue;
			}
			nodes.push(...this.evaluateMember(sourcePath, group, member, edgesBySource, visited, 1));
		}

		// Apply sibling sorting based on group configuration
		const sortConfig: SortConfig = {
			sortBy: group.sortBy ?? [],
			chainSort: group.chainSort ?? "primary",
			sequentialRelations: this.getSequentialRelations()
		};
		return sortSiblingsRecursively(nodes, edgesBySource, sortConfig);
	}

	private getSequentialRelations(): Set<string> {
		return new Set(
			this.settings.relations
				.filter((r) => r.visualDirection === "sequential")
				.map((r) => r.name)
		);
	}

	private evaluateMember(
		sourcePath: string,
		group: RelationGroup,
		member: RelationGroup["members"][number],
		edgesBySource: Map<string, RelationEdge[]>,
		visited: Set<string>,
		currentDepth: number
	): GroupTreeNode[] {
		const outgoing = edgesBySource.get(sourcePath) ?? [];
		const matching = outgoing.filter((edge) => edge.relation === member.relation);
		const nodes: GroupTreeNode[] = [];

		for (const edge of matching) {
			if (visited.has(edge.toPath)) {
				continue;
			}
			if (!this.matchesPropertyFilters(edge.toPath, group)) {
				continue;
			}
			visited.add(edge.toPath);
			const children: GroupTreeNode[] = [];

			if (member.depth === 0 || currentDepth < member.depth) {
				children.push(
					...this.evaluateMember(edge.toPath, group, member, edgesBySource, visited, currentDepth + 1)
				);
			}

			if (member.extend) {
				const extended = this.settings.groups.find((group) => group.name === member.extend);
				if (extended) {
					children.push(...this.evaluateGroup(edge.toPath, extended, edgesBySource, visited));
				}
			}

			const relationDef = this.settings.relations.find((r) => r.name === edge.relation);
			const visualDirection = relationDef?.visualDirection ?? "descending";

			nodes.push({
				path: edge.toPath,
				relation: edge.relation,
				depth: currentDepth,
				implied: edge.implied,
				impliedFrom: edge.impliedFrom,
				children,
				properties: this.getFileProperties(edge.toPath),
				visualDirection
			});
		}

		return nodes;
	}

	private buildEdgesBySource(): Map<string, RelationEdge[]> {
		const edges = this.getEdgesWithImplied();
		const edgesBySource = new Map<string, RelationEdge[]>();
		for (const edge of edges) {
			const list = edgesBySource.get(edge.fromPath) ?? [];
			list.push(edge);
			edgesBySource.set(edge.fromPath, list);
		}
		return edgesBySource;
	}

	private getEdgesWithImplied(): RelationEdge[] {
		const explicitEdges = Array.from(this.edgesBySource.values()).flat();
		return applyImpliedRules(explicitEdges, this.settings.relations);
	}

	private async parseFileData(
		file: TFile
	): Promise<{edges: RelationEdge[]; properties: FileProperties}> {
		const content = await this.app.vault.read(file);
		const allowedRelations = new Set(
			this.settings.relations
				.map((relation) => relation.name)
				.filter((name) => name.length > 0)
		);
		const inlineRelations = parseInlineRelations(content, allowedRelations);
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatterRelations = parseFrontmatterRelations(
			cache?.frontmatter,
			this.settings.relations
		);
		const excludeKeys = buildPropertyExcludeKeys(this.settings.relations);
		const properties = parseFileProperties(cache?.frontmatter, excludeKeys);

		const combined = [...inlineRelations, ...frontmatterRelations];
		const edges: RelationEdge[] = [];

		for (const relation of combined) {
			const targetFile = this.app.metadataCache.getFirstLinkpathDest(relation.target, file.path);
			if (!targetFile || !(targetFile instanceof TFile)) {
				continue;
			}
			edges.push({
				fromPath: file.path,
				toPath: targetFile.path,
				relation: relation.relation,
				implied: false
			});
		}

		return {edges, properties};
	}

	private getFileProperties(path: string): FileProperties {
		return this.propertiesByPath.get(path) ?? {};
	}

	private matchesPropertyFilters(
		path: string,
		group: RelationGroup
	): boolean {
		const filters = group.filters;
		if (!filters || filters.length === 0) {
			return true;
		}
		const properties = this.getFileProperties(path);
		const matchMode = group.filtersMatchMode ?? "all";
		if (matchMode === "any") {
			return filters.some((filter) => evaluatePropertyFilter(properties, filter));
		}
		return filters.every((filter) => evaluatePropertyFilter(properties, filter));
	}
}
