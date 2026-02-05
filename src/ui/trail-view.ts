import {ItemView, Menu, TFile, WorkspaceLeaf, setIcon} from "obsidian";
import TrailPlugin from "../main";
import type {DisplayGroup, GroupDefinition, GroupMember, RelationDefinition} from "../types";
import {tqlTreeToGroups, invertDisplayGroups} from "./tree-transforms";
import {
	renderEmptyState,
	renderFileLink,
	createCollapsibleSection
} from "./renderers";
import {parse, execute, createValidationContext, TQLError, getCache} from "../query";
import type {QueryResult, QueryResultNode} from "../query";
import {getRelationDisplayName} from "../settings";

export const TRAIL_VIEW_TYPE = "trail-view";

interface ParsedGroups {
	groupNames: string[];
	validatedByName: Map<string, ReturnType<typeof parse>>;
	astByQuery: Map<string, ReturnType<typeof parse>>;
	relationIds: string[];
}

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

		// Precompute parsed group ASTs and group names once for the entire refresh
		const parsedGroups = this.parseAllGroups();

		let visibleCount = 0;

		for (const group of tqlGroups) {
			if (group.enabled === false) {
				continue;
			}
			const wasRendered = this.renderTqlGroup(containerEl, group, activeFile.path, parsedGroups);
			if (wasRendered) {
				visibleCount++;
			}
		}

		if (visibleCount === 0) {
			containerEl.createDiv({cls: "trail-no-results", text: "No groups match this note"});
		}
	}

	/**
	 * Parse all group queries once and return a map of group name -> validated AST.
	 * Also returns the list of all group names for validation context.
	 */
	private parseAllGroups(): ParsedGroups {
		const settings = this.plugin.settings;
		const relationIds = settings.relations.map(r => r.id);
		const astByQuery = new Map<string, ReturnType<typeof parse>>();
		const groupNameByQuery = new Map<string, string>();
		const groupNames: string[] = [];

		// First pass: parse all queries and collect group names
		for (const group of settings.tqlGroups) {
			try {
				const ast = parse(group.query);
				astByQuery.set(group.query, ast);
				groupNameByQuery.set(group.query, ast.group);
				groupNames.push(ast.group);
			} catch {
				// Invalid query, skip for name collection
			}
		}

		// Second pass: validate all parsed ASTs with full group names list
		const validationCtx = createValidationContext(relationIds, groupNames);
		const validatedByName = new Map<string, ReturnType<typeof parse>>();

		for (const [query, ast] of astByQuery) {
			try {
				ast.validate(validationCtx);
				const name = groupNameByQuery.get(query)!;
				validatedByName.set(name, ast);
			} catch {
				// Validation failed, skip
			}
		}

		return {groupNames, validatedByName, astByQuery, relationIds};
	}

	private renderTqlGroup(
		containerEl: HTMLElement,
		group: GroupDefinition,
		filePath: string,
		parsedGroups: ParsedGroups
	): boolean {
		try {
			const result = this.executeTqlQuery(group.query, filePath, parsedGroups);

			if (!result.visible) {
				return false;
			}

			const isEmpty = result.results.length === 0;
			if (isEmpty && this.plugin.settings.hideEmptyGroups) {
				return false;
			}

			// Use precomputed group name or fall back to group.name
			let groupName = group.name;
			if (!groupName) {
				const ast = parsedGroups.astByQuery.get(group.query);
				groupName = ast?.group ?? "TQL Group";
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

	private executeTqlQuery(query: string, filePath: string, parsedGroups: ParsedGroups): QueryResult {
		// Check cache first
		const cache = getCache();
		const cached = cache.getResult(query, filePath);
		if (cached) {
			return cached;
		}

		// Use precomputed AST if available, otherwise parse fresh
		let ast = parsedGroups.astByQuery.get(query);
		if (!ast) {
			ast = parse(query);
			const validationCtx = createValidationContext(parsedGroups.relationIds, parsedGroups.groupNames);
			ast.validate(validationCtx);
		}

		const queryCtx = this.createQueryContext(filePath, parsedGroups);
		const result = execute(ast, queryCtx);

		// Store result in cache
		cache.setResult(query, filePath, result);

		return result;
	}

	private createQueryContext(filePath: string, parsedGroups: ParsedGroups) {
		const graph = this.plugin.graph;
		const settings = this.plugin.settings;
		const props = graph.getFileProperties?.(filePath) ?? {};

		// Precompute backlink index once per query context
		const backlinkIndex = this.buildBacklinkIndex();

		return {
			activeFilePath: filePath,
			activeFileProperties: props,
			getOutgoingEdges: (path: string, relation?: string) => {
				return graph.getOutgoingEdges(path, relation);
			},
			getIncomingEdges: (path: string, relation?: string) => {
				return graph.getIncomingEdges(path, relation);
			},
			getProperties: (path: string) => graph.getFileProperties?.(path) ?? {},
			getFileMetadata: (path: string) => {
				const file = this.plugin.app.vault.getAbstractFileByPath(path);
				if (!(file instanceof TFile)) return undefined;
				const metadataCache = this.plugin.app.metadataCache;
				const fileCache = metadataCache.getFileCache(file);
				
				// Get outgoing links from file cache
				const links = fileCache?.links?.map(l => l.link) ?? [];
				
				// Use precomputed backlink index
				const backlinks = backlinkIndex.get(path) ?? [];
				
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
			getRelationNames: () => settings.relations.map(r => r.id),
			getVisualDirection: (relation: string) => {
				const def = settings.relations.find(r => r.id === relation);
				return def?.visualDirection ?? "descending";
			},
			resolveGroupQuery: (name: string) => {
				return parsedGroups.validatedByName.get(name);
			},
		};
	}

	/**
	 * Build a reverse index from resolvedLinks: target path -> source paths.
	 */
	private buildBacklinkIndex(): Map<string, string[]> {
		const index = new Map<string, string[]>();
		const resolvedLinks = this.plugin.app.metadataCache.resolvedLinks;
		for (const sourcePath in resolvedLinks) {
			const targets = resolvedLinks[sourcePath];
			if (!targets) continue;
			for (const targetPath in targets) {
				const list = index.get(targetPath) ?? [];
				list.push(sourcePath);
				index.set(targetPath, list);
			}
		}
		return index;
	}

	/**
	 * Transforms TQL results to DisplayGroup[] based on visual direction.
	 */
	private transformTqlToDisplayGroups(nodes: QueryResultNode[]): DisplayGroup[] {
		if (nodes.length === 0) {
			return [];
		}
		
		const direction = nodes[0]?.visualDirection ?? "descending";
		
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
			
			// Relation tags at the start of members row
			const firstMember = group.members[0];
			if (firstMember) {
				for (const rel of firstMember.relations) {
					this.renderRelationTag(membersEl, rel, firstMember.implied);
				}
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

	private getRelationDefinition(relationId: string): RelationDefinition | undefined {
		return this.plugin.settings.relations.find(r => r.id === relationId);
	}

	private renderRelationTag(containerEl: HTMLElement, relationId: string, implied: boolean): void {
		const relationEl = containerEl.createSpan({cls: "trail-relation-tag"});
		const relationDef = this.getRelationDefinition(relationId);
		const displayName = relationDef ? getRelationDisplayName(relationDef) : relationId;

		if (relationDef?.icon) {
			setIcon(relationEl, relationDef.icon);
			relationEl.setAttribute("aria-label", displayName);
			relationEl.addClass("has-icon");
		} else {
			relationEl.setText(displayName);
		}

		if (implied) {
			relationEl.addClass("is-implied");
		}
	}
}
