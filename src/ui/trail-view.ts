import {ItemView, Menu, TFile, WorkspaceLeaf, setIcon} from "obsidian";
import TrailPlugin from "../main";
import type {RelationGroup} from "../types";
import type {GroupTreeNode} from "../graph/store";
import {invertTree, flattenTree} from "./tree-transforms";
import {
	renderEmptyState,
	renderFileLink,
	renderPropertyBadges,
	createCollapsibleSection
} from "./renderers";

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
			this.addFilterMenuItems(menu, relationTypes);
		}
		
		this.showMenuAtActionButtons(menu);
	}

	private addFilterMenuItems(menu: Menu, relationTypes: string[]) {
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

	private showMenuAtActionButtons(menu: Menu) {
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
			renderEmptyState(contentEl, "file-question", "No active note", "Open a note to see its relations");
			return;
		}

		this.initializeSelectedRelations();
		this.renderHeader(contentEl, activeFile);
		this.renderGroups(contentEl.createDiv({cls: "trail-content"}), activeFile);
	}

	private initializeSelectedRelations() {
		const relationTypes = this.plugin.graph.getRelationTypes();
		if (this.selectedRelations.size === 0) {
			for (const relation of relationTypes) {
				this.selectedRelations.add(relation);
			}
		}
	}

	private renderHeader(containerEl: HTMLElement, activeFile: TFile) {
		const contextEl = containerEl.createDiv({cls: "trail-context"});
		const noteIcon = contextEl.createSpan({cls: "trail-context-icon"});
		setIcon(noteIcon, "file-text");
		contextEl.createSpan({cls: "trail-context-text", text: activeFile.basename});

		const relationTypes = this.plugin.graph.getRelationTypes();
		if (this.selectedRelations.size < relationTypes.length && relationTypes.length > 0) {
			const filterBadge = contextEl.createSpan({cls: "trail-filter-badge"});
			filterBadge.setText(`${this.selectedRelations.size}/${relationTypes.length}`);
			filterBadge.setAttribute("aria-label", "Active relation filters");
		}
	}

	private renderGroups(containerEl: HTMLElement, activeFile: TFile) {
		const groups = this.plugin.settings.groups;
		if (groups.length === 0) {
			containerEl.createDiv({cls: "trail-no-results", text: "No groups configured"});
			return;
		}

		let visibleCount = 0;
		for (const group of groups) {
			if (!this.shouldShowGroup(group, activeFile.path)) {
				continue;
			}
			visibleCount++;
			this.renderGroup(containerEl, group, activeFile.path);
		}

		if (visibleCount === 0) {
			containerEl.createDiv({cls: "trail-no-results", text: "No groups match this note"});
		}
	}

	private shouldShowGroup(group: RelationGroup, filePath: string): boolean {
		const showConditions = group.showConditions ?? [];
		const showConditionsMode = group.showConditionsMatchMode ?? "all";
		return this.plugin.graph.matchesFilters(filePath, showConditions, showConditionsMode);
	}

	private renderGroup(containerEl: HTMLElement, group: RelationGroup, filePath: string) {
		const filteredGroup = this.filterGroupMembers(group);
		const tree = this.plugin.graph.getGroupTree(filePath, filteredGroup);
		const section = createCollapsibleSection(
			containerEl,
			group.name || "Unnamed group",
			"layers",
			tree.length
		);

		if (filteredGroup.members.length === 0) {
			section.contentEl.createDiv({cls: "trail-no-results", text: "No members selected"});
			return;
		}

		if (tree.length === 0) {
			section.contentEl.createDiv({cls: "trail-no-results", text: "No relations found"});
			return;
		}

		const transformedTree = this.transformTreeByDirection(tree);
		this.renderGroupTree(section.contentEl, transformedTree, 0, group.displayProperties ?? []);
	}

	private filterGroupMembers(group: RelationGroup): RelationGroup {
		const members = group.members.filter((member) => this.selectedRelations.has(member.relation));
		return {
			...group,
			members
		};
	}

	/**
	 * Transforms tree based on the dominant visual direction of nodes.
	 * - ascending: invert the tree (deepest becomes root)
	 * - sequential: flatten to siblings
	 * - descending: no transformation
	 */
	private transformTreeByDirection(nodes: GroupTreeNode[]): GroupTreeNode[] {
		if (nodes.length === 0) {
			return nodes;
		}
		
		const direction = nodes[0]?.visualDirection ?? "descending";
		
		switch (direction) {
			case "ascending":
				return invertTree(nodes);
			case "sequential":
				return flattenTree(nodes);
			case "descending":
			default:
				return nodes;
		}
	}

	private renderGroupTree(
		containerEl: HTMLElement,
		nodes: GroupTreeNode[],
		depth: number,
		displayProperties: string[]
	) {
		for (const node of nodes) {
			this.renderTreeNode(containerEl, node, depth, displayProperties);
		}
	}

	private renderTreeNode(
		containerEl: HTMLElement,
		node: GroupTreeNode,
		depth: number,
		displayProperties: string[]
	) {
		const itemEl = containerEl.createDiv({cls: "tree-item"});
		itemEl.style.setProperty("--indent-level", String(depth));

		const selfEl = itemEl.createDiv({cls: "tree-item-self is-clickable"});
		
		const relationEl = selfEl.createSpan({cls: "trail-relation-tag"});
		relationEl.setText(node.relation);
		if (node.implied) {
			relationEl.addClass("is-implied");
		}

		const innerEl = selfEl.createDiv({cls: "tree-item-inner"});
		renderFileLink(innerEl, this.plugin.app, node.path);
		renderPropertyBadges(innerEl, node.properties, displayProperties);

		if (node.children.length > 0) {
			const childrenEl = itemEl.createDiv({cls: "tree-item-children"});
			this.renderGroupTree(childrenEl, node.children, depth + 1, displayProperties);
		}
	}
}
