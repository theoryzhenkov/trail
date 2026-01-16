import {ItemView, Menu, TFile, WorkspaceLeaf, setIcon} from "obsidian";
import TrailPlugin from "../main";
import type {FileProperties, RelationGroup} from "../types";
import {GroupTreeNode} from "../graph/store";

/**
 * Inverts a tree chain so the deepest node becomes the root.
 * Parent -> Grandparent becomes Grandparent -> Parent
 */
function invertTree(nodes: GroupTreeNode[]): GroupTreeNode[] {
	const result: GroupTreeNode[] = [];
	for (const node of nodes) {
		result.push(...invertChain(node));
	}
	return result;
}

/**
 * Inverts a single chain: collects all nodes, reverses, rebuilds as chain.
 */
function invertChain(node: GroupTreeNode): GroupTreeNode[] {
	// Collect all nodes in the chain (depth-first, following first child)
	const chain: GroupTreeNode[] = [];
	let current: GroupTreeNode | undefined = node;
	while (current) {
		chain.push(current);
		// Follow the chain (first child), collect siblings separately
		current = current.children[0];
	}
	
	if (chain.length <= 1) {
		return [{ ...node, children: [] }];
	}
	
	// Reverse and rebuild as a chain
	chain.reverse();
	
	// Build the inverted chain from deepest to shallowest
	let result: GroupTreeNode | undefined;
	for (const item of chain) {
		const newNode: GroupTreeNode = {
			...item,
			children: result ? [result] : []
		};
		result = newNode;
	}
	
	return result ? [result] : [];
}

/**
 * Flattens a tree into a flat array of siblings (no children).
 */
function flattenTree(nodes: GroupTreeNode[]): GroupTreeNode[] {
	const result: GroupTreeNode[] = [];
	for (const node of nodes) {
		result.push({ ...node, children: [] });
		if (node.children.length > 0) {
			result.push(...flattenTree(node.children));
		}
	}
	return result;
}

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
		
		this.renderGroups(mainEl, activeFile);
	}

	private renderEmptyState(containerEl: HTMLElement, title: string, description: string) {
		const emptyEl = containerEl.createDiv({cls: "trail-empty-state"});
		const iconEl = emptyEl.createDiv({cls: "trail-empty-icon"});
		setIcon(iconEl, "file-question");
		emptyEl.createDiv({cls: "trail-empty-title", text: title});
		emptyEl.createDiv({cls: "trail-empty-description", text: description});
	}

	private renderGroups(containerEl: HTMLElement, activeFile: TFile) {
		const groups = this.plugin.settings.groups;
		if (groups.length === 0) {
			containerEl.createDiv({cls: "trail-no-results", text: "No groups configured"});
			return;
		}

		let visibleCount = 0;
		for (const group of groups) {
			// Check show conditions against active file
			const showConditions = group.showConditions ?? [];
			const showConditionsMode = group.showConditionsMatchMode ?? "all";
			if (!this.plugin.graph.matchesFilters(activeFile.path, showConditions, showConditionsMode)) {
				continue;
			}
			visibleCount++;

			const filteredGroup = this.filterGroupMembers(group);
			const tree = this.plugin.graph.getGroupTree(activeFile.path, filteredGroup);
			const section = this.createCollapsibleSection(
				containerEl,
				group.name || "Unnamed group",
				"layers",
				tree.length
			);

			if (filteredGroup.members.length === 0) {
				section.contentEl.createDiv({cls: "trail-no-results", text: "No members selected"});
				continue;
			}

		if (tree.length === 0) {
			section.contentEl.createDiv({cls: "trail-no-results", text: "No relations found"});
			continue;
		}

		// Transform tree based on visual direction
		const transformedTree = this.transformTreeByDirection(tree);
		this.renderGroupTree(section.contentEl, transformedTree, 0, group.displayProperties ?? []);
		}

		if (visibleCount === 0) {
			containerEl.createDiv({cls: "trail-no-results", text: "No groups match this note"});
		}
	}

	private filterGroupMembers(group: RelationGroup): RelationGroup {
		const members = group.members.filter((member) => this.selectedRelations.has(member.relation));
		return {
			name: group.name,
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
		
		// Detect dominant visual direction from first node
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
			const itemEl = containerEl.createDiv({cls: "tree-item"});
			itemEl.style.setProperty("--indent-level", String(depth));

			const selfEl = itemEl.createDiv({cls: "tree-item-self is-clickable"});
			const relationEl = selfEl.createSpan({cls: "trail-relation-tag"});
			relationEl.setText(node.relation);
			if (node.implied) {
				relationEl.addClass("is-implied");
			}

			const innerEl = selfEl.createDiv({cls: "tree-item-inner"});
			this.renderFileLink(innerEl, node.path);
			this.renderPropertyBadges(innerEl, node.properties, displayProperties);

			if (node.children.length > 0) {
				const childrenEl = itemEl.createDiv({cls: "tree-item-children"});
				this.renderGroupTree(childrenEl, node.children, depth + 1, displayProperties);
			}
		}
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

	private renderPropertyBadges(
		containerEl: HTMLElement,
		properties: FileProperties | undefined,
		displayProperties: string[]
	) {
		if (!properties || displayProperties.length === 0) {
			return;
		}

		const badges: string[] = [];
		for (const rawKey of displayProperties) {
			const key = rawKey.trim().toLowerCase();
			if (!key) {
				continue;
			}
			const value = properties[key];
			if (value === undefined) {
				continue;
			}
			if (Array.isArray(value)) {
				if (value.length === 0) {
					continue;
				}
				badges.push(`${key}: ${value.join(", ")}`);
				continue;
			}
			if (value === null) {
				badges.push(`${key}: null`);
				continue;
			}
			badges.push(`${key}: ${String(value)}`);
		}

		if (badges.length === 0) {
			return;
		}

		const badgesEl = containerEl.createDiv({cls: "trail-property-badges"});
		for (const badge of badges) {
			badgesEl.createSpan({cls: "trail-property-badge", text: badge});
		}
	}
}
