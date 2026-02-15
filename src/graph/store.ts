import {App, TFile} from "obsidian";
import {TrailSettings} from "../settings";
import {
	FileProperties,
	RelationEdge
} from "../types";
import {parseInlineRelations} from "../parsing/inline";
import {parseFileProperties, parseFrontmatterRelations} from "../parsing/frontmatter";
import {computeAncestors, AncestorNode} from "./traversal";
import {applyImpliedRules} from "./implied-relations";
import {buildPropertyExcludeKeys} from "./property-filters";
import {
	buildRelationIndexes,
	normalizeRelationName,
	resolveRelationUidByName,
} from "../relations";

export class GraphStore {
	private app: App;
	private settings: TrailSettings;
	private edgesBySource: Map<string, RelationEdge[]>;
	private edgesByTarget: Map<string, RelationEdge[]>;
	private edgesBySourceWithImplied: Map<string, RelationEdge[]>;
	private propertiesByPath: Map<string, FileProperties>;
	private staleFiles: Set<string>;
	private allStale: boolean;
	private changeListeners: Set<() => void>;
	private cachedEdgesWithImplied: RelationEdge[] | null;
	private relationByUid: Map<string, TrailSettings["relations"][number]>;
	private relationUidByNormalizedName: Map<string, string>;

	constructor(app: App, settings: TrailSettings) {
		this.app = app;
		this.settings = settings;
		this.edgesBySource = new Map();
		this.edgesByTarget = new Map();
		this.edgesBySourceWithImplied = new Map();
		this.propertiesByPath = new Map();
		this.staleFiles = new Set();
		this.allStale = true;
		this.changeListeners = new Set();
		this.cachedEdgesWithImplied = null;
		const indexes = buildRelationIndexes(this.settings.relations);
		this.relationByUid = indexes.byUid;
		this.relationUidByNormalizedName = indexes.uidByNormalizedName;
	}

	onDidChange(callback: () => void) {
		this.changeListeners.add(callback);
		return () => {
			this.changeListeners.delete(callback);
		};
	}

	updateSettings(settings: TrailSettings) {
		this.settings = settings;
		this.rebuildRelationIndexes();
		this.invalidateImpliedCache();
		this.rebuildTargetIndex();
	}

	async build() {
		this.edgesBySource.clear();
		this.edgesByTarget.clear();
		this.propertiesByPath.clear();
		this.cachedEdgesWithImplied = null;
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			await this.updateFile(file, false);
		}
		this.rebuildTargetIndex();
		this.staleFiles.clear();
		this.allStale = false;
		this.emitChange();
	}

	async updateFile(file: TFile, emit = true) {
		const {edges, properties} = await this.parseFileData(file);
		this.edgesBySource.set(file.path, edges);
		this.propertiesByPath.set(file.path, properties);
		this.invalidateImpliedCache();
		if (emit) {
			this.rebuildTargetIndex();
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
				this.invalidateImpliedCache();
			}
		}
		this.rebuildTargetIndex();
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
		this.invalidateImpliedCache();
		this.rebuildTargetIndex();
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
		this.invalidateImpliedCache();
		this.rebuildTargetIndex();
		this.emitChange();
	}

	private emitChange() {
		for (const listener of this.changeListeners) {
			listener();
		}
	}

	getRelationTypes(): string[] {
		// Build ordered list from settings
		const orderedTypes: string[] = [];
		const seen = new Set<string>();
		
		for (const relation of this.settings.relations) {
			const normalized = normalizeRelationName(relation.name);
			if (normalized && !seen.has(normalized)) {
				orderedTypes.push(relation.name);
				seen.add(normalized);
			}
		}
		
		// Add any relations found in edges but not in settings (append at end)
		for (const edge of this.getEdgesWithImplied()) {
			const relationName = this.getRelationName(edge.relationUid);
			const normalized = normalizeRelationName(relationName);
			if (!seen.has(normalized)) {
				orderedTypes.push(relationName);
				seen.add(normalized);
			}
		}
		
		return orderedTypes;
	}

	getIncomingEdges(path: string, relation?: string): RelationEdge[] {
		const edges = this.edgesByTarget.get(path) ?? [];
		if (!relation) {
			return edges;
		}
		const relationUid = this.resolveRelationUid(relation);
		if (!relationUid) {
			return [];
		}
		return edges.filter((edge) => edge.relationUid === relationUid);
	}

	getOutgoingEdges(path: string, relation?: string): RelationEdge[] {
		const edges = this.edgesBySourceWithImplied.get(path) ?? [];
		if (!relation) {
			return edges;
		}
		const relationUid = this.resolveRelationUid(relation);
		if (!relationUid) {
			return [];
		}
		return edges.filter((edge) => edge.relationUid === relationUid);
	}

	getAncestors(path: string, relationFilter?: Set<string>): AncestorNode[] {
		const relationUidFilter = relationFilter
			? new Set(
					Array.from(relationFilter)
						.map((relationName) => this.resolveRelationUid(relationName))
						.filter((uid): uid is string => Boolean(uid))
			  )
			: undefined;
		return computeAncestors(path, this.getEdgesWithImplied(), relationUidFilter, (uid) =>
			this.getRelationName(uid)
		);
	}

	private invalidateImpliedCache() {
		this.cachedEdgesWithImplied = null;
	}

	private rebuildRelationIndexes() {
		const indexes = buildRelationIndexes(this.settings.relations);
		this.relationByUid = indexes.byUid;
		this.relationUidByNormalizedName = indexes.uidByNormalizedName;
	}

	private resolveRelationUid(relation: string): string | undefined {
		if (this.relationByUid.has(relation)) {
			return relation;
		}
		return this.relationUidByNormalizedName.get(normalizeRelationName(relation));
	}

	getRelationName(relationUid: string): string {
		return this.relationByUid.get(relationUid)?.name ?? relationUid;
	}

	private rebuildTargetIndex() {
		this.edgesByTarget.clear();
		this.edgesBySourceWithImplied.clear();
		const edges = this.getEdgesWithImplied();
		for (const edge of edges) {
			const targetList = this.edgesByTarget.get(edge.toPath) ?? [];
			targetList.push(edge);
			this.edgesByTarget.set(edge.toPath, targetList);

			const sourceList = this.edgesBySourceWithImplied.get(edge.fromPath) ?? [];
			sourceList.push(edge);
			this.edgesBySourceWithImplied.set(edge.fromPath, sourceList);
		}
	}

	private getEdgesWithImplied(): RelationEdge[] {
		if (this.cachedEdgesWithImplied !== null) {
			return this.cachedEdgesWithImplied;
		}
		const explicitEdges = Array.from(this.edgesBySource.values()).flat();
		this.cachedEdgesWithImplied = applyImpliedRules(explicitEdges, this.settings.relations);
		return this.cachedEdgesWithImplied;
	}

	getEdgesByTarget(): Map<string, RelationEdge[]> {
		return this.edgesByTarget;
	}

	private async parseFileData(
		file: TFile
	): Promise<{edges: RelationEdge[]; properties: FileProperties}> {
		const content = await this.app.vault.read(file);
		const allowedRelations = new Set(
			this.settings.relations
				.map((relation) => normalizeRelationName(relation.name))
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
			// undefined source/target means currentFile
			let fromPath: string;
			let toPath: string;

			if (relation.source) {
				const sourceFile = this.app.metadataCache.getFirstLinkpathDest(relation.source, file.path);
				if (!sourceFile || !(sourceFile instanceof TFile)) {
					continue;
				}
				fromPath = sourceFile.path;
			} else {
				fromPath = file.path;
			}

			if (relation.target) {
				const targetFile = this.app.metadataCache.getFirstLinkpathDest(relation.target, file.path);
				if (!targetFile || !(targetFile instanceof TFile)) {
					continue;
				}
				toPath = targetFile.path;
			} else {
				toPath = file.path;
			}

			edges.push({
				fromPath,
				toPath,
				relationUid: resolveRelationUidByName(this.settings.relations, relation.relation) ?? "",
				implied: false
			});
		}

		return {
			edges: edges.filter((edge) => edge.relationUid.length > 0),
			properties,
		};
	}

	getFileProperties(path: string): FileProperties {
		return this.propertiesByPath.get(path) ?? {};
	}
}
