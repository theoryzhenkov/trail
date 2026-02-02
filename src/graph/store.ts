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

export class GraphStore {
	private app: App;
	private settings: TrailSettings;
	private edgesBySource: Map<string, RelationEdge[]>;
	private edgesByTarget: Map<string, RelationEdge[]>;
	private propertiesByPath: Map<string, FileProperties>;
	private staleFiles: Set<string>;
	private allStale: boolean;
	private changeListeners: Set<() => void>;
	private cachedEdgesWithImplied: RelationEdge[] | null;

	constructor(app: App, settings: TrailSettings) {
		this.app = app;
		this.settings = settings;
		this.edgesBySource = new Map();
		this.edgesByTarget = new Map();
		this.propertiesByPath = new Map();
		this.staleFiles = new Set();
		this.allStale = true;
		this.changeListeners = new Set();
		this.cachedEdgesWithImplied = null;
	}

	onDidChange(callback: () => void) {
		this.changeListeners.add(callback);
		return () => {
			this.changeListeners.delete(callback);
		};
	}

	updateSettings(settings: TrailSettings) {
		this.settings = settings;
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
			if (relation.id && !seen.has(relation.id)) {
				orderedTypes.push(relation.id);
				seen.add(relation.id);
			}
		}
		
		// Add any relations found in edges but not in settings (append at end)
		for (const edge of this.getEdgesWithImplied()) {
			if (!seen.has(edge.relation)) {
				orderedTypes.push(edge.relation);
				seen.add(edge.relation);
			}
		}
		
		return orderedTypes;
	}

	getIncomingEdges(path: string, relationFilter?: Set<string>): RelationEdge[] {
		const edges = this.edgesByTarget.get(path) ?? [];
		if (!relationFilter || relationFilter.size === 0) {
			return edges;
		}
		return edges.filter((edge) => relationFilter.has(edge.relation));
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

	private invalidateImpliedCache() {
		this.cachedEdgesWithImplied = null;
	}

	private rebuildTargetIndex() {
		this.edgesByTarget.clear();
		const edges = this.getEdgesWithImplied();
		for (const edge of edges) {
			const list = this.edgesByTarget.get(edge.toPath) ?? [];
			list.push(edge);
			this.edgesByTarget.set(edge.toPath, list);
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
				.map((relation) => relation.id)
				.filter((id) => id.length > 0)
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
			let fromPath: string;
			let toPath: string;

			if (relation.targetIsCurrentFile) {
				// Suffix syntax: [[A]]::rel means A -> currentFile
				const sourceFile = this.app.metadataCache.getFirstLinkpathDest(relation.target, file.path);
				if (!sourceFile || !(sourceFile instanceof TFile)) {
					continue;
				}
				fromPath = sourceFile.path;
				toPath = file.path;
			} else if (relation.source) {
				// Triple syntax: [[A]]::rel::[[B]] means A -> B
				const sourceFile = this.app.metadataCache.getFirstLinkpathDest(relation.source, file.path);
				const targetFile = this.app.metadataCache.getFirstLinkpathDest(relation.target, file.path);
				if (!sourceFile || !(sourceFile instanceof TFile)) {
					continue;
				}
				if (!targetFile || !(targetFile instanceof TFile)) {
					continue;
				}
				fromPath = sourceFile.path;
				toPath = targetFile.path;
			} else {
				// Prefix syntax: rel::[[A]] means currentFile -> A
				const targetFile = this.app.metadataCache.getFirstLinkpathDest(relation.target, file.path);
				if (!targetFile || !(targetFile instanceof TFile)) {
					continue;
				}
				fromPath = file.path;
				toPath = targetFile.path;
			}

			edges.push({
				fromPath,
				toPath,
				relation: relation.relation,
				implied: false
			});
		}

		return {edges, properties};
	}

	getFileProperties(path: string): FileProperties {
		return this.propertiesByPath.get(path) ?? {};
	}
}
