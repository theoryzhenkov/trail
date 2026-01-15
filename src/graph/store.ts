import {App, TFile} from "obsidian";
import {TrailSettings} from "../settings";
import {ImpliedRule, RelationEdge} from "../types";
import {parseInlineRelations} from "../parsing/inline";
import {parseFrontmatterRelations} from "../parsing/frontmatter";
import {computeAncestors, AncestorNode} from "./traversal";

export class GraphStore {
	private app: App;
	private settings: TrailSettings;
	private edgesBySource: Map<string, RelationEdge[]>;

	constructor(app: App, settings: TrailSettings) {
		this.app = app;
		this.settings = settings;
		this.edgesBySource = new Map();
	}

	updateSettings(settings: TrailSettings) {
		this.settings = settings;
	}

	async build() {
		this.edgesBySource.clear();
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			await this.updateFile(file);
		}
	}

	async updateFile(file: TFile) {
		const edges = await this.parseFileEdges(file);
		this.edgesBySource.set(file.path, edges);
	}

	getRelationTypes(): string[] {
		const types = new Set<string>();
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
		return applyImpliedRules(explicitEdges, this.settings.impliedRules);
	}

	private async parseFileEdges(file: TFile): Promise<RelationEdge[]> {
		const content = await this.app.vault.read(file);
		const inlineRelations = parseInlineRelations(content);
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatterRelations = parseFrontmatterRelations(cache?.frontmatter);

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

function applyImpliedRules(edges: RelationEdge[], rules: ImpliedRule[]): RelationEdge[] {
	if (rules.length === 0) {
		return edges;
	}

	const impliedEdges: RelationEdge[] = [];
	const existing = new Set(edges.map((edge) => edgeKey(edge)));

	for (const edge of edges) {
		for (const rule of rules) {
			const baseRelation = rule.baseRelation.trim().toLowerCase();
			const impliedRelation = rule.impliedRelation.trim().toLowerCase();
			if (!baseRelation || !impliedRelation) {
				continue;
			}
			if (edge.relation !== baseRelation) {
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
