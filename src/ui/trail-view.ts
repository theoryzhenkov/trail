import {ItemView, TFile, WorkspaceLeaf} from "obsidian";
import TrailPlugin from "../main";
import {RelationEdge} from "../types";

export const TRAIL_VIEW_TYPE = "trail-view";

export class TrailView extends ItemView {
	private plugin: TrailPlugin;
	private selectedRelations: Set<string>;

	constructor(leaf: WorkspaceLeaf, plugin: TrailPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.selectedRelations = new Set();
	}

	getViewType() {
		return TRAIL_VIEW_TYPE;
	}

	getDisplayText() {
		return "Trail";
	}

	async onOpen() {
		this.refresh();
	}

	refresh() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass("trail-view");

		contentEl.createEl("h2", {text: "Trail"});

		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile) {
			contentEl.createEl("p", {text: "No active note."});
			return;
		}

		contentEl.createEl("p", {text: `Active note: ${activeFile.basename}`});

		this.renderRelationFilters(contentEl);
		this.renderAncestors(contentEl, activeFile);
		this.renderDirectEdges(contentEl, activeFile);
	}

	private renderRelationFilters(containerEl: HTMLElement) {
		const relationTypes = this.plugin.graph.getRelationTypes();
		if (relationTypes.length === 0) {
			containerEl.createEl("p", {text: "No relations found yet."});
			return;
		}

		if (this.selectedRelations.size === 0) {
			for (const relation of relationTypes) {
				this.selectedRelations.add(relation);
			}
		}

		containerEl.createEl("h3", {text: "Relation filters"});
		const list = containerEl.createEl("div");

		for (const relation of relationTypes) {
			const row = list.createEl("label", {cls: "trail-filter-row"});
			const checkbox = row.createEl("input", {
				type: "checkbox"
			});
			checkbox.checked = this.selectedRelations.has(relation);
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.selectedRelations.add(relation);
				} else {
					this.selectedRelations.delete(relation);
				}
				this.refresh();
			});
			row.createEl("span", {text: relation});
		}
	}

	private renderAncestors(containerEl: HTMLElement, activeFile: TFile) {
		containerEl.createEl("h3", {text: "Ancestors"});
		const ancestors = this.plugin.graph.getAncestors(activeFile.path, this.selectedRelations);
		if (ancestors.length === 0) {
			containerEl.createEl("p", {text: "No ancestors found."});
			return;
		}

		const list = containerEl.createEl("ul", {cls: "trail-ancestor-list"});
		for (const ancestor of ancestors) {
			const item = list.createEl("li");
			item.style.paddingLeft = `${(ancestor.depth - 1) * 16}px`;
			const label = ancestor.implied
				? `${ancestor.viaRelation} (implied)`
				: ancestor.viaRelation;
			item.createEl("span", {text: `${label}: `});
			this.renderFileLink(item, ancestor.path);
		}
	}

	private renderDirectEdges(containerEl: HTMLElement, activeFile: TFile) {
		const edgesSection = containerEl.createEl("div");
		edgesSection.createEl("h3", {text: "Direct relations"});

		const incoming = this.plugin.graph.getIncomingEdges(activeFile.path, this.selectedRelations);
		const outgoing = this.plugin.graph.getOutgoingEdges(activeFile.path, this.selectedRelations);

		edgesSection.createEl("h4", {text: "Incoming"});
		this.renderEdgeList(edgesSection, incoming, (edge) => edge.fromPath);

		edgesSection.createEl("h4", {text: "Outgoing"});
		this.renderEdgeList(edgesSection, outgoing, (edge) => edge.toPath);
	}

	private renderEdgeList(containerEl: HTMLElement, edges: RelationEdge[], pathSelector: (edge: RelationEdge) => string) {
		if (edges.length === 0) {
			containerEl.createEl("p", {text: "None"});
			return;
		}
		const list = containerEl.createEl("ul");
		for (const edge of edges) {
			const item = list.createEl("li");
			const label = edge.implied ? `${edge.relation} (implied)` : edge.relation;
			item.createEl("span", {text: `${label}: `});
			this.renderFileLink(item, pathSelector(edge));
		}
	}

	private renderFileLink(containerEl: HTMLElement, path: string) {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		const label = file instanceof TFile ? file.basename : path;
		const link = containerEl.createEl("a", {text: label, cls: "trail-file-link"});
		link.addEventListener("click", () => {
			void this.plugin.app.workspace.openLinkText(label, path, false);
		});
	}
}
