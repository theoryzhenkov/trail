import {App, TFile} from "obsidian";
import {TrailSettings} from "../settings";
import {RelationDefinition, RelationEdge} from "../types";
import {parseInlineRelations} from "../parsing/inline";
import {parseFrontmatterRelations} from "../parsing/frontmatter";
import {computeAncestors, AncestorNode} from "./traversal";

export class GraphStore {
	private app: App;
	private settings: TrailSettings;
	private edgesBySource: Map<string, RelationEdge[]>;
	private staleFiles: Set<string>;
	private allStale: boolean;
	private changeListeners: Set<() => void>;

	constructor(app: App, settings: TrailSettings) {
		this.app = app;
		this.settings = settings;
		this.edgesBySource = new Map();
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
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			await this.updateFile(file, false);
		}
		this.staleFiles.clear();
		this.allStale = false;
		this.emitChange();
	}

	async updateFile(file: TFile, emit = true) {
		const edges = await this.parseFileEdges(file);
		this.edgesBySource.set(file.path, edges);
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

	private getEdgesWithImplied(): RelationEdge[] {
		const explicitEdges = Array.from(this.edgesBySource.values()).flat();
		return applyImpliedRules(explicitEdges, this.settings.relations);
	}

	private async parseFileEdges(file: TFile): Promise<RelationEdge[]> {
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

		return edges;
	}
}

function applyImpliedRules(edges: RelationEdge[], relations: RelationDefinition[]): RelationEdge[] {
	if (relations.length === 0) {
		return edges;
	}

	const impliedEdges: RelationEdge[] = [];
	const existing = new Set(edges.map((edge) => edgeKey(edge)));
	const impliedRules = buildImpliedRules(relations);

	for (const edge of edges) {
		const rulesForRelation = impliedRules.get(edge.relation) ?? [];
		for (const rule of rulesForRelation) {
			const baseRelation = rule.baseRelation.trim().toLowerCase();
			const impliedRelation = rule.impliedRelation.trim().toLowerCase();
			if (!baseRelation || !impliedRelation) {
				continue;
			}

			if (rule.direction === "forward" || rule.direction === "both") {
				const impliedEdge: RelationEdge = {
					fromPath: edge.fromPath,
					toPath: edge.toPath,
					relation: impliedRelation,
					implied: true,
					impliedFrom: edge.relation
				};
				addImplied(impliedEdge, impliedEdges, existing);
			}

			if (rule.direction === "reverse" || rule.direction === "both") {
				const impliedEdge: RelationEdge = {
					fromPath: edge.toPath,
					toPath: edge.fromPath,
					relation: impliedRelation,
					implied: true,
					impliedFrom: edge.relation
				};
				addImplied(impliedEdge, impliedEdges, existing);
			}
		}
	}

	return [...edges, ...impliedEdges];
}

function buildImpliedRules(relations: RelationDefinition[]): Map<string, Array<{
	baseRelation: string;
	impliedRelation: string;
	direction: "forward" | "reverse" | "both";
}>> {
	const map = new Map<string, Array<{
		baseRelation: string;
		impliedRelation: string;
		direction: "forward" | "reverse" | "both";
	}>>();

	for (const relation of relations) {
		const baseRelation = relation.name.trim().toLowerCase();
		if (!baseRelation) {
			continue;
		}
		for (const implied of relation.impliedRelations) {
			const impliedRelation = implied.targetRelation.trim().toLowerCase();
			if (!impliedRelation) {
				continue;
			}
			const list = map.get(baseRelation) ?? [];
			list.push({
				baseRelation,
				impliedRelation,
				direction: implied.direction
			});
			map.set(baseRelation, list);
		}
	}

	return map;
}

function addImplied(edge: RelationEdge, impliedEdges: RelationEdge[], existing: Set<string>) {
	const key = edgeKey(edge);
	if (existing.has(key)) {
		return;
	}
	existing.add(key);
	impliedEdges.push(edge);
}

function edgeKey(edge: RelationEdge): string {
	return `${edge.fromPath}|${edge.toPath}|${edge.relation}|${edge.implied}`;
}
