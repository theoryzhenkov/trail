import {ItemView, Menu, TFile, WorkspaceLeaf, setIcon} from "obsidian";
import TrailPlugin from "../main";
import type {DisplayGroup, GroupDefinition, GroupMember, RelationDefinition} from "../types";
import {tqlTreeToGroups, flattenTqlTree, invertDisplayGroups} from "./tree-transforms";
import {
	renderEmptyState,
	renderFileLink,
	createCollapsibleSection
} from "./renderers";
import {parse, execute, createValidationContext, TQLError, getCache} from "../query";
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

		if (tqlGroups.length === 0) {
			containerEl.createDiv({cls: "trail-no-results", text: "No groups configured"});
			return;
		}

		let visibleCount = 0;

		for (const group of tqlGroups) {
			if (group.enabled === false) {
				continue;
			}
			const wasRendered = this.renderTqlGroup(containerEl, group, activeFile.path);
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

			// Transform tree to display groups (display properties are pre-computed)
			const displayGroups = this.transformTqlToDisplayGroups(result.results);
			this.renderDisplayGroups(section.contentEl, displayGroups, 0);
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
		// Check cache first
		const cache = getCache();
		const cached = cache.getResult(query, filePath);
		if (cached) {
			return cached;
		}

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
		ast.validate(validationCtx);

		const queryCtx = this.createQueryContext(filePath);
		const result = execute(ast, queryCtx);

		// Store result in cache
		cache.setResult(query, filePath, result);

		return result;
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
				const metadataCache = this.plugin.app.metadataCache;
				const fileCache = metadataCache.getFileCache(file);
				
				// Get outgoing links from file cache
				const links = fileCache?.links?.map(l => l.link) ?? [];
				
				// Get backlinks by scanning resolvedLinks
				const backlinks: string[] = [];
				const resolvedLinks = metadataCache.resolvedLinks;
				for (const sourcePath in resolvedLinks) {
					const targets = resolvedLinks[sourcePath];
					if (targets && path in targets) {
						backlinks.push(sourcePath);
					}
				}
				
				return {
					name: file.basename,
					path: file.path,
					folder: file.parent?.path ?? "",
					created: new Date(file.stat.ctime),
					modified: new Date(file.stat.mtime),
					size: file.stat.size,
					tags: fileCache?.tags?.map(t => t.tag) ?? [],
					links,
					backlinks,
				};
			},
			getRelationNames: () => settings.relations.map(r => r.name),
			getVisualDirection: (relation: string) => {
				const def = settings.relations.find(r => r.name === relation);
				return def?.visualDirection ?? "descending";
			},
			getSequentialRelations: () => new Set(
				settings.relations
					.filter(r => r.visualDirection === "sequential")
					.map(r => r.name)
			),
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
					ast.validate(createValidationContext(relationNames, groupNames));
					return ast;
				} catch {
					return undefined;
				}
			},
		};
	}

	/**
	 * Transforms TQL results to DisplayGroup[] based on visual direction.
	 */
	private transformTqlToDisplayGroups(nodes: QueryResultNode[]): DisplayGroup[] {
		if (nodes.length === 0) {
			return [];
		}
		
		const direction = nodes[0]?.visualDirection ?? "descending";
		
		if (direction === "sequential") {
			// Flatten first, then convert to groups
			const flattened = flattenTqlTree(nodes);
			return tqlTreeToGroups(flattened);
		}
		
		// Convert to groups
		const groups = tqlTreeToGroups(nodes);
		
		// For ascending, invert so deepest ancestors appear at top
		if (direction === "ascending") {
			return invertDisplayGroups(groups);
		}
		
		return groups;
	}

	/**
	 * Renders an array of DisplayGroups.
	 */
	private renderDisplayGroups(
		containerEl: HTMLElement,
		groups: DisplayGroup[],
		depth: number
	) {
		for (const group of groups) {
			this.renderDisplayGroup(containerEl, group, depth);
		}
	}

	/**
	 * Renders a single DisplayGroup as a nested container with members and subgroups.
	 */
	private renderDisplayGroup(
		containerEl: HTMLElement,
		group: DisplayGroup,
		depth: number
	) {
		const groupEl = containerEl.createDiv({cls: "trail-group"});
		groupEl.style.setProperty("--group-depth", String(depth));

		// Render members with inline relation tag
		if (group.members.length > 0) {
			const membersEl = groupEl.createDiv({cls: "trail-group-members"});
			
			// Relation tag at the start of members row
			const firstMember = group.members[0];
			if (firstMember) {
				this.renderRelationTag(membersEl, firstMember.relation, firstMember.implied);
			}
			
			// Optional label (for split subgroups)
			if (group.label) {
				membersEl.createSpan({cls: "trail-group-label", text: group.label});
			}
			
			// File links
			for (const member of group.members) {
				this.renderGroupMember(membersEl, member);
			}
		}

		// Render subgroups recursively
		if (group.subgroups.length > 0) {
			const subgroupsEl = groupEl.createDiv({cls: "trail-group-subgroups"});
			this.renderDisplayGroups(subgroupsEl, group.subgroups, depth + 1);
		}
	}

	/**
	 * Renders a single group member (file link with optional properties).
	 */
	private renderGroupMember(
		containerEl: HTMLElement,
		member: GroupMember
	) {
		const memberEl = containerEl.createDiv({cls: "trail-group-member"});
		renderFileLink(memberEl, this.plugin.app, member.path);
		this.renderPropertyBadges(memberEl, member.displayProperties);
	}

	/**
	 * Renders property badges from pre-computed display property values.
	 */
	private renderPropertyBadges(
		containerEl: HTMLElement,
		displayProperties: GroupMember["displayProperties"]
	) {
		if (displayProperties.length === 0) {
			return;
		}

		const badges: string[] = [];

		for (const {key, value} of displayProperties) {
			if (value === undefined || value === null) continue;
			badges.push(this.formatPropertyValue(key, value));
		}

		if (badges.length === 0) return;

		const badgesEl = containerEl.createDiv({cls: "trail-property-badges"});
		for (const badge of badges) {
			badgesEl.createSpan({cls: "trail-property-badge", text: badge});
		}
	}

	/**
	 * Formats a property value for display as a badge.
	 */
	private formatPropertyValue(key: string, value: unknown): string {
		if (Array.isArray(value)) {
			if (value.length === 0) return "";
			return `${key}: ${value.join(", ")}`;
		}
		if (value === null) {
			return `${key}: null`;
		}
		if (typeof value === "object") {
			return `${key}: [object]`;
		}

		return `${key}: ${value as string | number | boolean}`;
	}

	private getRelationDefinition(relationName: string): RelationDefinition | undefined {
		return this.plugin.settings.relations.find(r => r.name === relationName);
	}

	private renderRelationTag(containerEl: HTMLElement, relationName: string, implied: boolean): void {
		const relationEl = containerEl.createSpan({cls: "trail-relation-tag"});
		const relationDef = this.getRelationDefinition(relationName);

		if (relationDef?.icon) {
			setIcon(relationEl, relationDef.icon);
			relationEl.setAttribute("aria-label", relationName);
			relationEl.addClass("has-icon");
		} else {
			relationEl.setText(relationName);
		}

		if (implied) {
			relationEl.addClass("is-implied");
		}
	}
}
