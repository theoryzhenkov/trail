import {ItemView, Menu, TFile, WorkspaceLeaf, setIcon} from "obsidian";
import TrailPlugin from "../main";
import {RelationEdge} from "../types";
import {AncestorNode} from "../graph/traversal";

export const TRAIL_VIEW_TYPE = "trail-view";

export class TrailView extends ItemView {
	private plugin: TrailPlugin;
	private selectedRelations: Set<string>;
	private showFilters: boolean = false;

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

	getIcon() {
		return "git-branch";
	}

	async onOpen() {
		this.addAction("filter", "Filter relations", () => {
			this.showFilterMenu();
		});
		
		this.addAction("refresh-cw", "Refresh", () => {
			void this.refresh();
		});

		void this.refresh();
	}

	private showFilterMenu() {
		const menu = new Menu();
		const relationTypes = this.plugin.graph.getRelationTypes();
		
		if (relationTypes.length === 0) {
			menu.addItem((item) => {
				item.setTitle("No relations defined");
				item.setDisabled(true);
			});
		} else {
			// Select all / none options
			menu.addItem((item) => {
				item.setTitle("Select all");
				item.setIcon("check-square");
				item.onClick(() => {
					for (const relation of relationTypes) {
						this.selectedRelations.add(relation);
					}
					void this.refresh();
				});
			});
			
			menu.addItem((item) => {
				item.setTitle("Select none");
				item.setIcon("square");
				item.onClick(() => {
					this.selectedRelations.clear();
					void this.refresh();
				});
			});
			
			menu.addSeparator();
			
			// Individual relation toggles
			for (const relation of relationTypes) {
				menu.addItem((item) => {
					const isSelected = this.selectedRelations.has(relation);
					item.setTitle(relation);
					item.setIcon(isSelected ? "check" : "");
					item.onClick(() => {
						if (isSelected) {
							this.selectedRelations.delete(relation);
						} else {
							this.selectedRelations.add(relation);
						}
						void this.refresh();
					});
				});
			}
		}
		
		// Position menu near the filter button
		const actionButtons = this.containerEl.querySelector(".view-actions");
		if (actionButtons) {
			const rect = actionButtons.getBoundingClientRect();
			menu.showAtPosition({x: rect.right, y: rect.bottom});
		} else {
			menu.showAtMouseEvent(new MouseEvent("click"));
		}
	}

	async refresh() {
		await this.plugin.graph.ensureFresh();
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass("trail-view");

		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile) {
			this.renderEmptyState(contentEl, "No active note", "Open a note to see its relations");
			return;
		}

		// Initialize selected relations if empty
		const relationTypes = this.plugin.graph.getRelationTypes();
		if (this.selectedRelations.size === 0) {
			for (const relation of relationTypes) {
				this.selectedRelations.add(relation);
			}
		}

		// Active note context
		const contextEl = contentEl.createDiv({cls: "trail-context"});
		const noteIcon = contextEl.createSpan({cls: "trail-context-icon"});
		setIcon(noteIcon, "file-text");
		contextEl.createSpan({cls: "trail-context-text", text: activeFile.basename});

		// Active filters indicator
		if (this.selectedRelations.size < relationTypes.length && relationTypes.length > 0) {
			const filterBadge = contextEl.createSpan({cls: "trail-filter-badge"});
			filterBadge.setText(`${this.selectedRelations.size}/${relationTypes.length}`);
			filterBadge.setAttribute("aria-label", "Active relation filters");
		}

		// Main content
		const mainEl = contentEl.createDiv({cls: "trail-content"});
		
		this.renderAncestors(mainEl, activeFile);
		this.renderDirectEdges(mainEl, activeFile);
	}

	private renderEmptyState(containerEl: HTMLElement, title: string, description: string) {
		const emptyEl = containerEl.createDiv({cls: "trail-empty-state"});
		const iconEl = emptyEl.createDiv({cls: "trail-empty-icon"});
		setIcon(iconEl, "file-question");
		emptyEl.createDiv({cls: "trail-empty-title", text: title});
		emptyEl.createDiv({cls: "trail-empty-description", text: description});
	}

	private renderAncestors(containerEl: HTMLElement, activeFile: TFile) {
		const ancestors = this.plugin.graph.getAncestors(activeFile.path, this.selectedRelations);
		
		const section = this.createCollapsibleSection(containerEl, "Ancestors", "git-merge", ancestors.length);
		
		if (ancestors.length === 0) {
			section.contentEl.createDiv({cls: "trail-no-results", text: "No ancestors found"});
			return;
		}

		this.renderAncestorTree(section.contentEl, ancestors);
	}

	private renderAncestorTree(containerEl: HTMLElement, ancestors: AncestorNode[]) {
		const treeEl = containerEl.createDiv({cls: "tree-item-children"});
		
		for (const ancestor of ancestors) {
			this.renderTreeItem(treeEl, ancestor);
		}
	}

	private renderTreeItem(containerEl: HTMLElement, ancestor: AncestorNode) {
		const itemEl = containerEl.createDiv({cls: "tree-item"});
		itemEl.style.setProperty("--indent-level", String(ancestor.depth - 1));
		
		const selfEl = itemEl.createDiv({cls: "tree-item-self is-clickable"});
		
		// Relation badge
		const relationEl = selfEl.createSpan({cls: "trail-relation-tag"});
		const relationLabel = ancestor.implied 
			? `${ancestor.viaRelation}` 
			: ancestor.viaRelation;
		relationEl.setText(relationLabel);
		if (ancestor.implied) {
			relationEl.addClass("is-implied");
		}
		
		// File link
		const innerEl = selfEl.createDiv({cls: "tree-item-inner"});
		this.renderFileLink(innerEl, ancestor.path);
	}

	private renderDirectEdges(containerEl: HTMLElement, activeFile: TFile) {
		const incoming = this.plugin.graph.getIncomingEdges(activeFile.path, this.selectedRelations);
		const outgoing = this.plugin.graph.getOutgoingEdges(activeFile.path, this.selectedRelations);

		// Incoming section
		const incomingSection = this.createCollapsibleSection(
			containerEl, 
			"Incoming", 
			"arrow-down-left",
			incoming.length
		);
		this.renderEdgeList(incomingSection.contentEl, incoming, (edge) => edge.fromPath);

		// Outgoing section
		const outgoingSection = this.createCollapsibleSection(
			containerEl, 
			"Outgoing", 
			"arrow-up-right",
			outgoing.length
		);
		this.renderEdgeList(outgoingSection.contentEl, outgoing, (edge) => edge.toPath);
	}

	private createCollapsibleSection(
		containerEl: HTMLElement, 
		title: string, 
		icon: string,
		count: number
	): {headerEl: HTMLElement; contentEl: HTMLElement} {
		const sectionEl = containerEl.createDiv({cls: "tree-item trail-section"});
		
		const headerEl = sectionEl.createDiv({cls: "tree-item-self trail-section-header is-clickable"});
		
		const collapseIcon = headerEl.createDiv({cls: "tree-item-icon collapse-icon"});
		setIcon(collapseIcon, "chevron-down");
		
		const iconEl = headerEl.createSpan({cls: "trail-section-icon"});
		setIcon(iconEl, icon);
		
		const titleEl = headerEl.createSpan({cls: "tree-item-inner trail-section-title"});
		titleEl.setText(title);
		
		if (count > 0) {
			const countEl = headerEl.createSpan({cls: "tree-item-flair"});
			countEl.createSpan({cls: "tree-item-flair-text", text: String(count)});
		}
		
		const contentEl = sectionEl.createDiv({cls: "tree-item-children trail-section-content"});
		
		// Collapse/expand functionality
		let isCollapsed = false;
		headerEl.addEventListener("click", () => {
			isCollapsed = !isCollapsed;
			sectionEl.toggleClass("is-collapsed", isCollapsed);
			collapseIcon.toggleClass("is-collapsed", isCollapsed);
		});
		
		return {headerEl, contentEl};
	}

	private renderEdgeList(
		containerEl: HTMLElement, 
		edges: RelationEdge[], 
		pathSelector: (edge: RelationEdge) => string
	) {
		if (edges.length === 0) {
			containerEl.createDiv({cls: "tree-item-flair-text trail-no-results", text: "None"});
			return;
		}

		// Group edges by relation type
		const grouped = new Map<string, RelationEdge[]>();
		for (const edge of edges) {
			const key = edge.relation;
			if (!grouped.has(key)) {
				grouped.set(key, []);
			}
			grouped.get(key)!.push(edge);
		}

		for (const [relation, groupEdges] of grouped) {
			for (const edge of groupEdges) {
				const itemEl = containerEl.createDiv({cls: "tree-item"});
				const selfEl = itemEl.createDiv({cls: "tree-item-self is-clickable"});
				
				// Relation badge
				const relationEl = selfEl.createSpan({cls: "trail-relation-tag"});
				relationEl.setText(relation);
				if (edge.implied) {
					relationEl.addClass("is-implied");
				}
				
				// File link
				const innerEl = selfEl.createDiv({cls: "tree-item-inner"});
				this.renderFileLink(innerEl, pathSelector(edge));
			}
		}
	}

	private renderFileLink(containerEl: HTMLElement, path: string) {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		const label = file instanceof TFile ? file.basename : path;
		const link = containerEl.createEl("a", {
			text: label, 
			cls: "internal-link",
			attr: {"data-path": path}
		});
		link.addEventListener("click", (e) => {
			e.preventDefault();
			void this.plugin.app.workspace.openLinkText(path, "", false);
		});
	}
}
