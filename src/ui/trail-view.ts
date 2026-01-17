import {ItemView, Menu, TFile, WorkspaceLeaf, setIcon} from "obsidian";
import TrailPlugin from "../main";
import type {GroupDefinition, RelationGroup} from "../types";
import type {GroupTreeNode} from "../graph/store";
import {invertTree, flattenTree} from "./tree-transforms";
import {
	renderEmptyState,
	renderFileLink,
	renderPropertyBadges,
	createCollapsibleSection
} from "./renderers";
import {parse, execute, createValidationContext, validate, TQLError} from "../query";
import type {QueryResult, QueryResultNode} from "../query";

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
		const tqlGroups = this.plugin.settings.tqlGroups;
		const legacyGroups = this.plugin.settings.groups;

		if (tqlGroups.length === 0 && legacyGroups.length === 0) {
			containerEl.createDiv({cls: "trail-no-results", text: "No groups configured"});
			return;
		}

		let visibleCount = 0;

		// Render TQL groups first
		for (const group of tqlGroups) {
			if (group.enabled === false) {
				continue;
			}
			const wasRendered = this.renderTqlGroup(containerEl, group, activeFile.path);
			if (wasRendered) {
				visibleCount++;
			}
		}

		// Render legacy groups
		for (const group of legacyGroups) {
			if (!this.shouldShowGroup(group, activeFile.path)) {
				continue;
			}
			const wasRendered = this.renderGroup(containerEl, group, activeFile.path);
			if (wasRendered) {
				visibleCount++;
			}
		}

		if (visibleCount === 0) {
			containerEl.createDiv({cls: "trail-no-results", text: "No groups match this note"});
		}
	}

	private renderTqlGroup(containerEl: HTMLElement, group: GroupDefinition, filePath: string): boolean {
		try {
			const result = this.executeTqlQuery(group.query, filePath);

			if (!result.visible) {
				return false;
			}

			const isEmpty = result.results.length === 0;
			if (isEmpty && this.plugin.settings.hideEmptyGroups) {
				return false;
			}

			// Extract group name from query
			let groupName = group.name;
			if (!groupName) {
				try {
					const ast = parse(group.query);
					groupName = ast.group;
				} catch {
					groupName = "TQL Group";
				}
			}

			const section = createCollapsibleSection(
				containerEl,
				groupName,
				"layers",
				result.results.length
			);

			if (isEmpty) {
				section.contentEl.createDiv({cls: "trail-no-results", text: "No relations found"});
				return true;
			}

			// Get display properties from parsed query
			let displayProperties: string[] = [];
			try {
				const ast = parse(group.query);
				if (ast.display) {
					displayProperties = ast.display.properties.map(p => p.path.join("."));
				}
			} catch {
				// Ignore parse errors for display properties
			}

			this.renderTqlResults(section.contentEl, result.results, 0, displayProperties);
			return true;
		} catch (e) {
			// Show error in UI
			const section = createCollapsibleSection(
				containerEl,
				group.name ?? "TQL Group",
				"alert-triangle",
				0
			);
			const errorMsg = e instanceof TQLError ? e.message : String(e);
			section.contentEl.createDiv({cls: "trail-error", text: `Query error: ${errorMsg}`});
			return true;
		}
	}

	private executeTqlQuery(query: string, filePath: string): QueryResult {
		const ast = parse(query);
		const relationNames = this.plugin.settings.relations.map(r => r.name);
		const groupNames = this.plugin.settings.tqlGroups
			.map(g => {
				try {
					return parse(g.query).group;
				} catch {
					return null;
				}
			})
			.filter((n): n is string => n !== null);

		const validationCtx = createValidationContext(relationNames, groupNames);
		const validated = validate(ast, validationCtx);

		const queryCtx = this.createQueryContext(filePath);
		return execute(validated, queryCtx);
	}

	private createQueryContext(filePath: string) {
		const graph = this.plugin.graph;
		const settings = this.plugin.settings;
		const props = graph.getFileProperties?.(filePath) ?? {};

		return {
			activeFilePath: filePath,
			activeFileProperties: props,
			getOutgoingEdges: (path: string, relation?: string) => {
				const filter = relation ? new Set([relation]) : undefined;
				return graph.getOutgoingEdges(path, filter);
			},
			getIncomingEdges: (path: string, relation?: string) => {
				const filter = relation ? new Set([relation]) : undefined;
				return graph.getIncomingEdges(path, filter);
			},
			getProperties: (path: string) => graph.getFileProperties?.(path) ?? {},
			getFileMetadata: (path: string) => {
				const file = this.plugin.app.vault.getAbstractFileByPath(path);
				if (!(file instanceof TFile)) return undefined;
				const cache = this.plugin.app.metadataCache.getFileCache(file);
				return {
					name: file.basename,
					path: file.path,
					folder: file.parent?.path ?? "",
					created: new Date(file.stat.ctime),
					modified: new Date(file.stat.mtime),
					size: file.stat.size,
					tags: cache?.tags?.map(t => t.tag) ?? [],
				};
			},
			getRelationNames: () => settings.relations.map(r => r.name),
			getVisualDirection: (relation: string) => {
				const def = settings.relations.find(r => r.name === relation);
				return def?.visualDirection ?? "descending";
			},
			resolveGroupQuery: (name: string) => {
				const group = settings.tqlGroups.find(g => {
					try {
						return parse(g.query).group === name;
					} catch {
						return false;
					}
				});
				if (!group) return undefined;
				try {
					const ast = parse(group.query);
					const relationNames = settings.relations.map(r => r.name);
					const groupNames = settings.tqlGroups
						.map(g => {
							try { return parse(g.query).group; } catch { return null; }
						})
						.filter((n): n is string => n !== null);
					return validate(ast, createValidationContext(relationNames, groupNames));
				} catch {
					return undefined;
				}
			},
		};
	}

	private renderTqlResults(
		containerEl: HTMLElement,
		nodes: QueryResultNode[],
		depth: number,
		displayProperties: string[]
	) {
		for (const node of nodes) {
			this.renderTqlNode(containerEl, node, depth, displayProperties);
		}
	}

	private renderTqlNode(
		containerEl: HTMLElement,
		node: QueryResultNode,
		depth: number,
		displayProperties: string[]
	) {
		const itemEl = containerEl.createDiv({cls: "tree-item"});
		itemEl.style.setProperty("--indent-level", String(depth));

		if (node.hasFilteredAncestor) {
			itemEl.createDiv({cls: "trail-gap-indicator", text: "..."});
		}

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
			this.renderTqlResults(childrenEl, node.children, depth + 1, displayProperties);
		}
	}

	private shouldShowGroup(group: RelationGroup, filePath: string): boolean {
		const showConditions = group.showConditions ?? [];
		const showConditionsMode = group.showConditionsMatchMode ?? "all";
		return this.plugin.graph.matchesFilters(filePath, showConditions, showConditionsMode);
	}

	private renderGroup(containerEl: HTMLElement, group: RelationGroup, filePath: string): boolean {
		const filteredGroup = this.filterGroupMembers(group);
		const tree = this.plugin.graph.getGroupTree(filePath, filteredGroup);

		const isEmpty = filteredGroup.members.length === 0 || tree.length === 0;
		if (isEmpty && this.plugin.settings.hideEmptyGroups) {
			return false;
		}

		const section = createCollapsibleSection(
			containerEl,
			group.name || "Unnamed group",
			"layers",
			tree.length
		);

		if (filteredGroup.members.length === 0) {
			section.contentEl.createDiv({cls: "trail-no-results", text: "No members selected"});
			return true;
		}

		if (tree.length === 0) {
			section.contentEl.createDiv({cls: "trail-no-results", text: "No relations found"});
			return true;
		}

		const transformedTree = this.transformTreeByDirection(tree);
		this.renderGroupTree(section.contentEl, transformedTree, 0, group.displayProperties ?? []);
		return true;
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
