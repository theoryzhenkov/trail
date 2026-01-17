import {App, Notice, PluginSettingTab, setIcon, Setting, TextAreaComponent} from "obsidian";
import TrailPlugin from "../main";
import {
	ChainSortMode,
	FilterMatchMode,
	GroupDefinition,
	ImpliedRelation,
	PropertyFilter,
	PropertySortKey,
	RelationAlias,
	RelationAliasType,
	RelationDefinition,
	RelationGroup,
	RelationGroupMember,
	SortDirection,
	VisualDirection
} from "../types";
import {isValidRelationName, normalizeRelationName} from "./validation";
import {parse, TQLError} from "../query";
import {migrateGroup} from "../query/migration";
import {hasLegacyGroups, EditorMode} from "./index";
import {isVisualEditable, parseToVisual, visualToQuery, VisualQuery} from "./visual-editor";

export class TrailSettingTab extends PluginSettingTab {
	plugin: TrailPlugin;
	private openSections: Set<number> = new Set();
	private openGroupSections: Set<number> = new Set();

	constructor(app: App, plugin: TrailPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		// Save current open state before clearing
		this.saveOpenState(containerEl);
		this.saveGroupOpenState(containerEl);

		containerEl.empty();
		containerEl.addClass("trail-settings");

		this.renderRelations(containerEl);
		this.renderGroups(containerEl);
	}

	private saveOpenState(containerEl: HTMLElement) {
		const details = containerEl.querySelectorAll<HTMLDetailsElement>(".trail-relation-section");
		this.openSections.clear();
		details.forEach((el, index) => {
			if (el.open) {
				this.openSections.add(index);
			}
		});
	}

	private saveGroupOpenState(containerEl: HTMLElement) {
		const details = containerEl.querySelectorAll<HTMLDetailsElement>(".trail-group-section");
		this.openGroupSections.clear();
		details.forEach((el, index) => {
			if (el.open) {
				this.openGroupSections.add(index);
			}
		});
	}

	private renderReorderControls<T>(containerEl: HTMLElement, index: number, array: T[]) {
		const controls = containerEl.createDiv({cls: "trail-reorder-controls"});

		const upButton = controls.createEl("button", {
			cls: "trail-reorder-button",
			attr: {"aria-label": "Move up"}
		});
		setIcon(upButton, "arrow-up");
		upButton.disabled = index === 0;
		upButton.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			if (index > 0) {
				const item = array[index];
				const prev = array[index - 1];
				if (item !== undefined && prev !== undefined) {
					array[index] = prev;
					array[index - 1] = item;
					void this.plugin.saveSettings();
					this.display();
				}
			}
		});

		const downButton = controls.createEl("button", {
			cls: "trail-reorder-button",
			attr: {"aria-label": "Move down"}
		});
		setIcon(downButton, "arrow-down");
		downButton.disabled = index === array.length - 1;
		downButton.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			if (index < array.length - 1) {
				const item = array[index];
				const next = array[index + 1];
				if (item !== undefined && next !== undefined) {
					array[index] = next;
					array[index + 1] = item;
					void this.plugin.saveSettings();
					this.display();
				}
			}
		});
	}

	private renderRelations(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Relations")
			.setDesc("Define relation types and their aliases.");

		for (const [index, relation] of this.plugin.settings.relations.entries()) {
			this.renderRelationSection(containerEl, relation, index);
		}

		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText("Add relation")
					.setCta()
					.onClick(() => {
						const newIndex = this.plugin.settings.relations.length;
						this.plugin.settings.relations.push({
							name: "",
							aliases: [],
							impliedRelations: []
						});
						// Auto-expand the new section
						this.openSections.add(newIndex);
						void this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderGroups(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Groups")
			.setDesc("Configure relation groups shown in the trail pane using TQL queries.");

		new Setting(containerEl)
			.setName("Hide empty groups")
			.setDesc("Hide groups that have no relations for the current note.")
			.addToggle((toggle) => {
				toggle
					.setValue(Boolean(this.plugin.settings.hideEmptyGroups))
					.onChange((value) => {
						this.plugin.settings.hideEmptyGroups = value;
						void this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Editor mode")
			.setDesc("How to display TQL group editors. Auto shows visual editor for simple queries.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("auto", "Auto")
					.addOption("visual", "Visual")
					.addOption("query", "Query")
					.setValue(this.plugin.settings.editorMode ?? "auto")
					.onChange((value) => {
						this.plugin.settings.editorMode = value as "visual" | "query" | "auto";
						void this.plugin.saveSettings();
						this.display();
					});
			});

		// Migration banner if legacy groups exist
		if (hasLegacyGroups(this.plugin.settings)) {
			this.renderMigrationBanner(containerEl);
		}

		// TQL Groups
		for (const [index, group] of this.plugin.settings.tqlGroups.entries()) {
			this.renderTqlGroupSection(containerEl, group, index);
		}

		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText("Add TQL group")
					.setCta()
					.onClick(() => {
						const newIndex = this.plugin.settings.tqlGroups.length;
						this.plugin.settings.tqlGroups.push({
							query: `group "New group"\nfrom up depth unlimited`,
							enabled: true,
						});
						this.openGroupSections.add(newIndex);
						void this.plugin.saveSettings();
						this.display();
					});
			});

		// Legacy Groups section (if any exist)
		if (hasLegacyGroups(this.plugin.settings)) {
			this.renderLegacyGroupsSection(containerEl);
		}
	}

	private renderMigrationBanner(containerEl: HTMLElement) {
		const banner = containerEl.createDiv({cls: "trail-migration-banner"});
		
		new Setting(banner)
			.setName("Legacy groups detected")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("Your configuration includes legacy groups. Click 'Migrate' on each group below to convert them to TQL format.")
			.setHeading();
	}

	private renderTqlGroupSection(containerEl: HTMLElement, group: GroupDefinition, index: number) {
		const details = containerEl.createEl("details", {cls: "trail-relation-section trail-group-section trail-tql-group"});
		const wasOpen = this.openGroupSections.has(index);
		details.open = wasOpen;

		const summary = details.createEl("summary", {cls: "trail-relation-summary"});
		const summaryContent = summary.createDiv({cls: "trail-relation-summary-content"});

		// Extract name from query
		const groupName = this.extractGroupName(group.query) ?? group.name ?? "(unnamed)";
		const nameSpan = summaryContent.createEl("span", {
			cls: "trail-relation-name",
			text: groupName
		});
		if (!groupName || groupName === "(unnamed)") {
			nameSpan.addClass("trail-relation-name-empty");
		}

		const badges = summaryContent.createDiv({cls: "trail-relation-badges"});
		badges.createEl("span", {cls: "trail-badge trail-badge-tql", text: "TQL"});
		if (group.enabled === false) {
			badges.createEl("span", {cls: "trail-badge trail-badge-disabled", text: "disabled"});
		}

		this.renderReorderControls(summary, index, this.plugin.settings.tqlGroups);

		const content = details.createDiv({cls: "trail-relation-content"});

		// Enabled toggle
		new Setting(content)
			.setName("Enabled")
			.setDesc("Show this group in the trail pane.")
			.addToggle((toggle) => {
				toggle
					.setValue(group.enabled !== false)
					.onChange((value) => {
						group.enabled = value;
						void this.plugin.saveSettings();
						this.display();
					});
			});

		// Determine editor mode
		const editorMode = this.plugin.settings.editorMode ?? "auto";
		const canVisualEdit = isVisualEditable(group.query);
		const showVisual = editorMode === "visual" || (editorMode === "auto" && canVisualEdit);

		// Error container (shared by both editors)
		const errorContainer = content.createDiv({cls: "trail-query-error"});

		if (showVisual && canVisualEdit) {
			this.renderVisualEditor(content, group, index, nameSpan, errorContainer);
		} else {
			this.renderQueryEditor(content, group, nameSpan, errorContainer);
		}

		// Mode toggle button
		if (canVisualEdit || editorMode === "query") {
			const modeLabel = showVisual && canVisualEdit ? "Edit as query" : "Edit visually";
			const modeDesc = showVisual && canVisualEdit 
				? "Switch to raw TQL query editor"
				: canVisualEdit 
					? "Switch to visual form editor"
					: "Query is too complex for visual editing";

			new Setting(content)
				.setName(modeLabel)
				.setDesc(modeDesc)
				.addButton((button) => {
					button
						.setButtonText(showVisual && canVisualEdit ? "Query mode" : "Visual mode")
						.setDisabled(!canVisualEdit && !showVisual)
						.onClick(() => {
							// Toggle between visual and query mode
							const newMode: EditorMode = showVisual ? "query" : "visual";
							this.plugin.settings.editorMode = newMode;
							void this.plugin.saveSettings();
							this.display();
						});
				});
		}

		// Delete button
		new Setting(content)
			.addButton((button) => {
				button
					.setButtonText("Delete group")
					.setWarning()
					.onClick(() => {
						this.plugin.settings.tqlGroups.splice(index, 1);
						void this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderQueryEditor(
		content: HTMLElement,
		group: GroupDefinition,
		nameSpan: HTMLElement,
		errorContainer: HTMLElement
	) {
		new Setting(content)
			.setName("Query")
			.setDesc("TQL query defining this group.")
			.addTextArea((textarea: TextAreaComponent) => {
				textarea
					.setValue(group.query)
					.setPlaceholder('group "My group"\nfrom up depth unlimited')
					.onChange((value) => {
						group.query = value;
						this.validateQuery(value, errorContainer, nameSpan);
						void this.plugin.saveSettings();
					});
				textarea.inputEl.rows = 6;
				textarea.inputEl.addClass("trail-query-textarea");
			});

		// Initial validation
		this.validateQuery(group.query, errorContainer, nameSpan);
	}

	private renderVisualEditor(
		content: HTMLElement,
		group: GroupDefinition,
		index: number,
		nameSpan: HTMLElement,
		errorContainer: HTMLElement
	) {
		const visual = parseToVisual(group.query);
		if (!visual) {
			// Fall back to query editor
			this.renderQueryEditor(content, group, nameSpan, errorContainer);
			return;
		}

		// Group name
		new Setting(content)
			.setName("Name")
			.setDesc("Display name for this group.")
			.addText((text) => {
				text
					.setValue(visual.name)
					.setPlaceholder("Group name")
					.onChange((value) => {
						visual.name = value;
						this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
					});
			});

		// Relations
		const relationsContainer = content.createDiv({cls: "trail-visual-relations"});
		new Setting(relationsContainer)
			.setName("Relations")
			.setDesc("Relations to traverse.")
			.setHeading();

		for (const [i, rel] of visual.relations.entries()) {
			const relEl = relationsContainer.createDiv({cls: "trail-visual-relation"});
			
			new Setting(relEl)
				.addDropdown((dropdown) => {
					// Add all relations from settings
					for (const r of this.plugin.settings.relations) {
						dropdown.addOption(r.name, r.name);
					}
					dropdown
						.setValue(rel.name)
						.onChange((value) => {
							rel.name = value;
							this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
						});
				})
				.addText((text) => {
					const depthVal = rel.depth === "unlimited" ? "" : String(rel.depth);
					text
						.setValue(depthVal)
						.setPlaceholder("unlimited")
						.onChange((value) => {
							if (!value || value.toLowerCase() === "unlimited") {
								rel.depth = "unlimited";
							} else {
								const parsed = parseInt(value, 10);
								rel.depth = isNaN(parsed) ? "unlimited" : parsed;
							}
							this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
						});
					text.inputEl.style.width = "80px";
				})
				.addExtraButton((btn) => {
					btn
						.setIcon("x")
						.setTooltip("Remove relation")
						.onClick(() => {
							visual.relations.splice(i, 1);
							if (visual.relations.length === 0) {
								// Keep at least one relation
								visual.relations.push({name: "up", depth: "unlimited"});
							}
							this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
							this.display();
						});
				});
		}

		// Add relation button
		new Setting(relationsContainer)
			.addButton((btn) => {
				btn
					.setButtonText("Add relation")
					.onClick(() => {
						visual.relations.push({name: "up", depth: "unlimited"});
						this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
						this.display();
					});
			});

		// Sort (optional)
		new Setting(content)
			.setName("Sort by")
			.setDesc("Property to sort results by (optional).")
			.addText((text) => {
				text
					.setValue(visual.sort?.property ?? "")
					.setPlaceholder("No sorting")
					.onChange((value) => {
						if (value) {
							visual.sort = {property: value, direction: visual.sort?.direction ?? "asc"};
						} else {
							visual.sort = undefined;
						}
						this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
					});
			})
			.addDropdown((dropdown) => {
				dropdown
					.addOption("asc", "Ascending")
					.addOption("desc", "Descending")
					.setValue(visual.sort?.direction ?? "asc")
					.onChange((value) => {
						if (visual.sort) {
							visual.sort.direction = value as "asc" | "desc";
							this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
						}
					});
			});

		// Display properties (optional)
		new Setting(content)
			.setName("Display properties")
			.setDesc("Comma-separated list of properties to show (optional).")
			.addText((text) => {
				text
					.setValue(visual.display?.join(", ") ?? "")
					.setPlaceholder("No extra properties")
					.onChange((value) => {
						if (value.trim()) {
							visual.display = value.split(",").map(s => s.trim()).filter(Boolean);
						} else {
							visual.display = undefined;
						}
						this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
					});
			});
	}

	private updateGroupFromVisual(
		group: GroupDefinition,
		visual: VisualQuery,
		nameSpan: HTMLElement,
		errorContainer: HTMLElement
	) {
		group.query = visualToQuery(visual);
		nameSpan.textContent = visual.name || "(unnamed)";
		this.validateQuery(group.query, errorContainer, nameSpan);
		void this.plugin.saveSettings();
	}

	private validateQuery(query: string, errorEl: HTMLElement, nameEl: HTMLElement) {
		errorEl.empty();
		try {
			const ast = parse(query);
			nameEl.textContent = ast.group || "(unnamed)";
			nameEl.removeClass("trail-relation-name-empty");
			errorEl.removeClass("trail-query-error-visible");
		} catch (e) {
			if (e instanceof TQLError) {
				errorEl.textContent = e.message;
				errorEl.addClass("trail-query-error-visible");
			} else {
				errorEl.textContent = String(e);
				errorEl.addClass("trail-query-error-visible");
			}
		}
	}

	private extractGroupName(query: string): string | null {
		try {
			const ast = parse(query);
			return ast.group;
		} catch {
			// Try simple regex extraction as fallback
			const match = query.match(/group\s+"([^"]+)"/);
			return match?.[1] ?? null;
		}
	}

	private renderLegacyGroupsSection(containerEl: HTMLElement) {
		const section = containerEl.createDiv({cls: "trail-legacy-groups"});
		
		new Setting(section)
			.setName("Legacy groups")
			.setDesc("These groups use the old format. Migrate them to TQL for full functionality.")
			.setHeading();

		for (const [index, group] of this.plugin.settings.groups.entries()) {
			this.renderLegacyGroupSection(section, group, index);
		}
	}

	private renderLegacyGroupSection(containerEl: HTMLElement, group: RelationGroup, index: number) {
		const item = containerEl.createDiv({cls: "trail-legacy-group-item"});

		const header = item.createDiv({cls: "trail-legacy-group-header"});
		header.createSpan({text: group.name || "(unnamed)", cls: "trail-legacy-group-name"});

		const actions = header.createDiv({cls: "trail-legacy-group-actions"});

		// Migrate button
		const migrateBtn = actions.createEl("button", {text: "Migrate to TQL", cls: "mod-cta"});
		migrateBtn.addEventListener("click", () => {
			const tqlGroup = migrateGroup(group);
			this.plugin.settings.tqlGroups.push(tqlGroup);
			this.plugin.settings.groups.splice(index, 1);
			void this.plugin.saveSettings();
			new Notice(`Migrated "${group.name}" to TQL`);
			this.display();
		});

		// Delete button
		const deleteBtn = actions.createEl("button", {text: "Delete", cls: "mod-warning"});
		deleteBtn.addEventListener("click", () => {
			this.plugin.settings.groups.splice(index, 1);
			void this.plugin.saveSettings();
			this.display();
		});

		// Preview generated TQL
		const preview = item.createDiv({cls: "trail-legacy-preview"});
		const previewToggle = preview.createEl("button", {text: "Show generated TQL"});
		const previewContent = preview.createDiv({cls: "trail-legacy-preview-content trail-hidden"});

		previewToggle.addEventListener("click", () => {
			if (previewContent.hasClass("trail-hidden")) {
				const tqlGroup = migrateGroup(group);
				previewContent.empty();
				previewContent.createEl("pre", {text: tqlGroup.query});
				previewContent.removeClass("trail-hidden");
				previewToggle.textContent = "Hide generated TQL";
			} else {
				previewContent.addClass("trail-hidden");
				previewToggle.textContent = "Show generated TQL";
			}
		});
	}

	private renderGroupSection(containerEl: HTMLElement, group: RelationGroup, index: number) {
		const details = containerEl.createEl("details", {cls: "trail-relation-section trail-group-section"});
		const wasOpen = this.openGroupSections.has(index);
		const isNew = !group.name;
		details.open = wasOpen || isNew;

		const summary = details.createEl("summary", {cls: "trail-relation-summary"});
		const summaryContent = summary.createDiv({cls: "trail-relation-summary-content"});

		const nameSpan = summaryContent.createEl("span", {
			cls: "trail-relation-name",
			text: group.name || "(unnamed)"
		});
		if (!group.name) {
			nameSpan.addClass("trail-relation-name-empty");
		}

		const badges = summaryContent.createDiv({cls: "trail-relation-badges"});
		badges.createEl("span", {
			cls: "trail-badge",
			text: `${group.members.length} member${group.members.length !== 1 ? "s" : ""}`
		});

		this.renderReorderControls(summary, index, this.plugin.settings.groups);

		const content = details.createDiv({cls: "trail-relation-content"});

		new Setting(content)
			.setName("Name")
			.setDesc("Group label shown in the trail pane.")
			.addText((text) => {
				text
					.setPlaceholder("E.g., hierarchy, navigation")
					.setValue(group.name)
					.onChange((value) => {
						group.name = value.trim();
						void this.plugin.saveSettings();
						nameSpan.textContent = group.name || "(unnamed)";
						nameSpan.toggleClass("trail-relation-name-empty", !group.name);
					});
			});

		this.renderGroupMembers(content, group);
		this.renderGroupProperties(content, group);
		this.renderGroupSorting(content, group);
		this.renderGroupFilters(content, group);
		this.renderGroupShowConditions(content, group);

		new Setting(content)
			.addButton((button) => {
				button
					.setButtonText("Delete group")
					.setWarning()
					.onClick(() => {
						this.plugin.settings.groups.splice(index, 1);
						void this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderGroupMembers(containerEl: HTMLElement, group: RelationGroup) {
		const section = containerEl.createDiv({cls: "trail-subsection"});
		new Setting(section)
			.setName("Members")
			.setDesc("Relations to show together in this group.");

		if (group.members.length === 0) {
			section.createEl("p", {text: "No members defined.", cls: "trail-empty-state"});
		} else {
			for (const [memberIndex, member] of group.members.entries()) {
				this.renderGroupMemberRow(section, group, member, memberIndex);
			}
		}

		new Setting(section)
			.addButton((button) => {
				button.setButtonText("Add member").onClick(() => {
					group.members.push({
						relation: "",
						depth: 1
					});
					void this.plugin.saveSettings();
					this.display();
				});
			});
	}

	private renderGroupProperties(containerEl: HTMLElement, group: RelationGroup) {
		const section = containerEl.createDiv({cls: "trail-subsection"});
		new Setting(section)
			.setName("Display properties")
			.setDesc("Frontmatter keys to show as badges on files.")
			.addText((text) => {
				const current = group.displayProperties ?? [];
				text
					.setPlaceholder("E.g., gender, age")
					.setValue(current.join(", "))
					.onChange((value) => {
						const properties = value
							.split(",")
							.map((item) => item.trim().toLowerCase())
							.filter((item) => item.length > 0);
						group.displayProperties = properties;
						void this.plugin.saveSettings();
					});
			});
	}

	private renderGroupSorting(containerEl: HTMLElement, group: RelationGroup) {
		const section = containerEl.createDiv({cls: "trail-subsection"});
		new Setting(section)
			.setName("Sorting")
			.setDesc("Configure how items are sorted within this group.");

		// Chain sort mode
		new Setting(section)
			.setName("Chain sort priority")
			.setDesc("How sequential relation chains (e.g., next/prev) interact with property sorting.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("primary", "Primary (chains first)")
					.addOption("secondary", "Secondary (properties first)")
					.addOption("disabled", "Disabled (no chain sorting)")
					.setValue(group.chainSort ?? "primary")
					.onChange((value) => {
						group.chainSort = value as ChainSortMode;
						void this.plugin.saveSettings();
					});
			});

		// Sort by properties
		const sortKeys = group.sortBy ?? [];
		if (sortKeys.length === 0) {
			section.createEl("p", {text: "No sort keys defined. Items sorted alphabetically.", cls: "trail-empty-state"});
		} else {
			for (const [keyIndex, sortKey] of sortKeys.entries()) {
				this.renderSortKeyRow(section, group, sortKey, keyIndex);
			}
		}

		new Setting(section)
			.addButton((button) => {
				button.setButtonText("Add sort key").onClick(() => {
					const next: PropertySortKey = {
						property: "",
						direction: "asc"
					};
					group.sortBy = [...sortKeys, next];
					void this.plugin.saveSettings();
					this.display();
				});
			});
	}

	private renderSortKeyRow(
		containerEl: HTMLElement,
		group: RelationGroup,
		sortKey: PropertySortKey,
		index: number
	) {
		const setting = new Setting(containerEl);

		setting
			.addText((text) => {
				text
					.setPlaceholder("Property name")
					.setValue(sortKey.property)
					.onChange((value) => {
						sortKey.property = value.trim().toLowerCase();
						void this.plugin.saveSettings();
					});
			})
			.addDropdown((dropdown) => {
				dropdown
					.addOption("asc", "Ascending (a→z)")
					.addOption("desc", "Descending (z→a)")
					.setValue(sortKey.direction)
					.onChange((value) => {
						sortKey.direction = value as SortDirection;
						void this.plugin.saveSettings();
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("arrow-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(() => {
						const sortKeys = group.sortBy ?? [];
						const prev = sortKeys[index - 1];
						const curr = sortKeys[index];
						if (index > 0 && prev && curr) {
							sortKeys[index - 1] = curr;
							sortKeys[index] = prev;
							void this.plugin.saveSettings();
							this.display();
						}
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("arrow-down")
					.setTooltip("Move down")
					.setDisabled(index === (group.sortBy?.length ?? 0) - 1)
					.onClick(() => {
						const sortKeys = group.sortBy ?? [];
						const curr = sortKeys[index];
						const next = sortKeys[index + 1];
						if (index < sortKeys.length - 1 && curr && next) {
							sortKeys[index] = next;
							sortKeys[index + 1] = curr;
							void this.plugin.saveSettings();
							this.display();
						}
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("trash")
					.setTooltip("Remove")
					.onClick(() => {
						group.sortBy = (group.sortBy ?? []).filter((_, i) => i !== index);
						void this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderGroupFilters(containerEl: HTMLElement, group: RelationGroup) {
		const section = containerEl.createDiv({cls: "trail-subsection"});
		new Setting(section)
			.setName("Filters")
			.setDesc("Only include files that match these property filters.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("all", "Match all")
					.addOption("any", "Match any")
					.setValue(group.filtersMatchMode ?? "all")
					.onChange((value) => {
						group.filtersMatchMode = value as FilterMatchMode;
						void this.plugin.saveSettings();
					});
			});

		const filters = group.filters ?? [];
		if (filters.length === 0) {
			section.createEl("p", {text: "No filters defined.", cls: "trail-empty-state"});
		} else {
			for (const [filterIndex, filter] of filters.entries()) {
				this.renderGroupFilterRow(section, group, filter, filterIndex);
			}
		}

		new Setting(section)
			.addButton((button) => {
				button.setButtonText("Add filter").onClick(() => {
					const next: PropertyFilter = {
						key: "",
						operator: "equals",
						value: ""
					};
					group.filters = [...filters, next];
					void this.plugin.saveSettings();
					this.display();
				});
			});
	}

	private renderGroupFilterRow(
		containerEl: HTMLElement,
		group: RelationGroup,
		filter: PropertyFilter,
		index: number
	) {
		this.renderPropertyFilterRow(containerEl, filter, () => {
			group.filters = (group.filters ?? []).filter((_, i) => i !== index);
			void this.plugin.saveSettings();
			this.display();
		});
	}

	private renderGroupShowConditions(containerEl: HTMLElement, group: RelationGroup) {
		const section = containerEl.createDiv({cls: "trail-subsection"});
		new Setting(section)
			.setName("Show conditions")
			.setDesc("Only show this group when the active note matches these conditions.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("all", "Match all")
					.addOption("any", "Match any")
					.setValue(group.showConditionsMatchMode ?? "all")
					.onChange((value) => {
						group.showConditionsMatchMode = value as FilterMatchMode;
						void this.plugin.saveSettings();
					});
			});

		const conditions = group.showConditions ?? [];
		if (conditions.length === 0) {
			section.createEl("p", {text: "No conditions defined. Group always visible.", cls: "trail-empty-state"});
		} else {
			for (const [conditionIndex, condition] of conditions.entries()) {
				this.renderShowConditionRow(section, group, condition, conditionIndex);
			}
		}

		new Setting(section)
			.addButton((button) => {
				button.setButtonText("Add condition").onClick(() => {
					const next: PropertyFilter = {
						key: "",
						operator: "equals",
						value: ""
					};
					group.showConditions = [...conditions, next];
					void this.plugin.saveSettings();
					this.display();
				});
			});
	}

	private renderShowConditionRow(
		containerEl: HTMLElement,
		group: RelationGroup,
		condition: PropertyFilter,
		index: number
	) {
		this.renderPropertyFilterRow(containerEl, condition, () => {
			group.showConditions = (group.showConditions ?? []).filter((_, i) => i !== index);
			void this.plugin.saveSettings();
			this.display();
		});
	}

	private renderPropertyFilterRow(
		containerEl: HTMLElement,
		filter: PropertyFilter,
		onDelete: () => void
	) {
		const setting = new Setting(containerEl);

		setting
			.addText((text) => {
				text
					.setPlaceholder("Property key")
					.setValue(filter.key)
					.onChange((value) => {
						filter.key = value.trim().toLowerCase();
						void this.plugin.saveSettings();
					});
			})
			.addDropdown((dropdown) => {
				dropdown
					.addOption("equals", "Equals")
					.addOption("contains", "Contains")
					.addOption("exists", "Exists")
					.addOption("notExists", "Not exists")
					.setValue(filter.operator)
					.onChange((value) => {
						filter.operator = value as PropertyFilter["operator"];
						void this.plugin.saveSettings();
						this.display();
					});
			})
			.addText((text) => {
				const valueText = filter.value === undefined ? "" : String(filter.value);
				text
					.setPlaceholder("Value")
					.setValue(valueText)
					.setDisabled(filter.operator === "exists" || filter.operator === "notExists")
					.onChange((value) => {
						filter.value = value;
						void this.plugin.saveSettings();
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("trash")
					.setTooltip("Remove")
					.onClick(onDelete);
			});
	}

	private renderGroupMemberRow(
		containerEl: HTMLElement,
		group: RelationGroup,
		member: RelationGroupMember,
		index: number
	) {
		const setting = new Setting(containerEl);

		setting
			.addDropdown((dropdown) => {
				dropdown.addOption("", "(select relation)");
				for (const option of this.getAllRelationOptions()) {
					dropdown.addOption(option, option);
				}
				if (member.relation && !this.getAllRelationOptions().includes(member.relation)) {
					dropdown.addOption(member.relation, member.relation);
				}
				dropdown
					.setValue(member.relation)
					.onChange((value) => {
						member.relation = value;
						void this.plugin.saveSettings();
					});
			})
			.addText((text) => {
				text
					.setPlaceholder("1")
					.setValue(String(member.depth ?? 1));
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.step = "1";
				text.onChange((value) => {
					const parsed = Number(value);
					if (Number.isNaN(parsed) || parsed < 0) {
						return;
					}
					member.depth = parsed;
					void this.plugin.saveSettings();
				});
			})
			.addDropdown((dropdown) => {
				dropdown.addOption("", "No extend");
				for (const option of this.getGroupNameOptions(group.name)) {
					dropdown.addOption(option, option);
				}
				dropdown
					.setValue(member.extend ?? "")
					.onChange((value) => {
						member.extend = value || undefined;
						void this.plugin.saveSettings();
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("arrow-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(() => {
						if (index > 0) {
							const prev = group.members[index - 1];
							const curr = group.members[index];
							if (prev && curr) {
								group.members[index - 1] = curr;
								group.members[index] = prev;
								void this.plugin.saveSettings();
								this.display();
							}
						}
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("arrow-down")
					.setTooltip("Move down")
					.setDisabled(index === group.members.length - 1)
					.onClick(() => {
						if (index < group.members.length - 1) {
							const curr = group.members[index];
							const next = group.members[index + 1];
							if (curr && next) {
								group.members[index] = next;
								group.members[index + 1] = curr;
								void this.plugin.saveSettings();
								this.display();
							}
						}
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("trash")
					.setTooltip("Remove member")
					.onClick(() => {
						group.members.splice(index, 1);
						void this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderRelationSection(containerEl: HTMLElement, relation: RelationDefinition, index: number) {
		const details = containerEl.createEl("details", {cls: "trail-relation-section"});
		
		// Restore open state: open if was open before, or if new/empty relation
		const wasOpen = this.openSections.has(index);
		const isNew = !relation.name;
		details.open = wasOpen || isNew;

		const summary = details.createEl("summary", {cls: "trail-relation-summary"});
		const summaryContent = summary.createDiv({cls: "trail-relation-summary-content"});
		
		const nameSpan = summaryContent.createEl("span", {
			cls: "trail-relation-name",
			text: relation.name || "(unnamed)"
		});
		if (!relation.name) {
			nameSpan.addClass("trail-relation-name-empty");
		}

		const badges = summaryContent.createDiv({cls: "trail-relation-badges"});
		badges.createEl("span", {
			cls: "trail-badge",
			text: `${relation.aliases.length} alias${relation.aliases.length !== 1 ? "es" : ""}`
		});
		badges.createEl("span", {
			cls: "trail-badge",
			text: `${relation.impliedRelations.length} implied`
		});

		this.renderReorderControls(summary, index, this.plugin.settings.relations);

		const content = details.createDiv({cls: "trail-relation-content"});

		// Relation name
		new Setting(content)
			.setName("Name")
			.setDesc("Unique identifier for this relation type.")
			.addText((text) => {
				text
					.setPlaceholder("E.g., up, parent, contains")
					.setValue(relation.name)
					.onChange((value) => {
						const normalized = normalizeRelationName(value);
						if (value && !isValidRelationName(normalized)) {
							new Notice("Relation names must use letters, numbers, underscore, or dash.");
							text.setValue(relation.name);
							return;
						}
						if (normalized && this.isDuplicateRelationName(normalized, index)) {
							new Notice("Relation name already exists.");
							text.setValue(relation.name);
							return;
						}
						const previousName = relation.name;
						relation.name = normalized;
						this.updateImpliedRelationTargets(previousName, normalized);
						this.updateGroupMemberRelations(previousName, normalized);
						void this.plugin.saveSettings();
						// Update just the summary name
						nameSpan.textContent = normalized || "(unnamed)";
						nameSpan.toggleClass("trail-relation-name-empty", !normalized);
					});
			});

		// Visual direction
		new Setting(content)
			.setName("Visual direction")
			.setDesc("How items are displayed: descending (indent increases), ascending (indent decreases), or sequential (flat, sorted).")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("descending", "Descending (children)")
					.addOption("ascending", "Ascending (ancestors)")
					.addOption("sequential", "Sequential (flat)")
					.setValue(relation.visualDirection ?? "descending")
					.onChange((value) => {
						relation.visualDirection = value as VisualDirection;
						void this.plugin.saveSettings();
					});
			});

		// Aliases subsection
		this.renderAliasesSubsection(content, relation);

		// Implied relations subsection
		this.renderImpliedSubsection(content, relation);

		// Delete button
		new Setting(content)
			.addButton((button) => {
				button
					.setButtonText("Delete relation")
					.setWarning()
					.onClick(() => {
						this.plugin.settings.relations.splice(index, 1);
						this.removeImpliedRelationTargets(relation.name);
						this.removeGroupMemberRelations(relation.name);
						void this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderAliasesSubsection(containerEl: HTMLElement, relation: RelationDefinition) {
		const section = containerEl.createDiv({cls: "trail-subsection"});
		new Setting(section)
			.setName("Aliases")
			.setDesc("Frontmatter keys that map to this relation.");

		if (relation.aliases.length === 0) {
			section.createEl("p", {text: "No aliases defined.", cls: "trail-empty-state"});
		} else {
			for (const [aliasIndex, alias] of relation.aliases.entries()) {
				this.renderAliasRow(section, relation, alias, aliasIndex);
			}
		}

		new Setting(section)
			.addButton((button) => {
				button.setButtonText("Add alias").onClick(() => {
					relation.aliases.push({
						type: "property",
						key: relation.name || "key"
					});
					void this.plugin.saveSettings();
					this.display();
				});
			});
	}

	private renderAliasRow(containerEl: HTMLElement, relation: RelationDefinition, alias: RelationAlias, index: number) {
		new Setting(containerEl)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("property", "Property (up:)")
					.addOption("dotProperty", "Dot (relations.up:)")
					.addOption("relationsMap", "Map (relations: {up:})")
					.setValue(alias.type)
					.onChange((value) => {
						alias.type = value as RelationAliasType;
						void this.plugin.saveSettings();
					});
			})
			.addText((text) => {
				text
					.setPlaceholder(relation.name || "key")
					.setValue(alias.key);
				
				// Store current value for comparison
				let currentValue = alias.key;
				
				// Update on change but don't validate yet
				text.onChange((value) => {
					currentValue = value;
				});
				
				// Validate and save on blur
				text.inputEl.addEventListener("blur", () => {
					const normalized = currentValue.trim().toLowerCase();
					if (!normalized) {
						new Notice("Alias key cannot be empty.");
						text.setValue(alias.key);
						return;
					}
					if (normalized !== alias.key) {
						alias.key = normalized;
						text.setValue(normalized);
						void this.plugin.saveSettings();
					}
				});
			})
			.addExtraButton((button) => {
				button
					.setIcon("trash")
					.setTooltip("Remove alias")
					.onClick(() => {
						relation.aliases.splice(index, 1);
						void this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderImpliedSubsection(containerEl: HTMLElement, relation: RelationDefinition) {
		const section = containerEl.createDiv({cls: "trail-subsection"});
		new Setting(section)
			.setName("Implied relations")
			.setDesc("Other relations that are automatically created when this relation exists.");

		if (relation.impliedRelations.length === 0) {
			section.createEl("p", {text: "No implied relations.", cls: "trail-empty-state"});
		} else {
			for (const [impliedIndex, implied] of relation.impliedRelations.entries()) {
				this.renderImpliedRow(section, relation, implied, impliedIndex);
			}
		}

		const options = this.getRelationOptions(relation.name);
		if (options.length > 0) {
			new Setting(section)
				.addButton((button) => {
					button.setButtonText("Add implied relation").onClick(() => {
						relation.impliedRelations.push({
							targetRelation: options[0] ?? "",
							direction: "forward"
						});
						void this.plugin.saveSettings();
						this.display();
					});
				});
		} else {
			section.createEl("p", {
				text: "Add more relations to create implied rules.",
				cls: "trail-hint"
			});
		}
	}

	private renderImpliedRow(
		containerEl: HTMLElement,
		relation: RelationDefinition,
		implied: ImpliedRelation,
		index: number
	) {
		const setting = new Setting(containerEl);
		
		setting
			.addDropdown((dropdown) => {
				const options = this.getRelationOptions(relation.name);
				for (const option of options) {
					dropdown.addOption(option, option);
				}
				dropdown
					.setValue(implied.targetRelation)
					.onChange((value) => {
						implied.targetRelation = value;
						void this.plugin.saveSettings();
					});
			})
			.addDropdown((dropdown) => {
				dropdown
					.addOption("forward", "Forward (→)")
					.addOption("reverse", "Reverse (←)")
					.addOption("both", "Both (↔)")
					.addOption("sibling", "Sibling (⇌)")
					.setValue(implied.direction)
					.onChange((value) => {
						implied.direction = value as ImpliedRelation["direction"];
						void this.plugin.saveSettings();
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("trash")
					.setTooltip("Remove implied relation")
					.onClick(() => {
						relation.impliedRelations.splice(index, 1);
						void this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private getRelationOptions(excludeName: string): string[] {
		return this.plugin.settings.relations
			.map((r) => r.name)
			.filter((name) => name.length > 0 && name !== excludeName);
	}

	private getAllRelationOptions(): string[] {
		return this.plugin.settings.relations
			.map((r) => r.name)
			.filter((name) => name.length > 0);
	}

	private getGroupNameOptions(excludeName: string): string[] {
		return this.plugin.settings.groups
			.map((group) => group.name)
			.filter((name) => name.length > 0 && name !== excludeName);
	}

	private isDuplicateRelationName(name: string, currentIndex: number): boolean {
		return this.plugin.settings.relations.some((r, i) => i !== currentIndex && r.name === name);
	}

	private updateImpliedRelationTargets(oldName: string, newName: string) {
		if (!oldName || oldName === newName) {
			return;
		}
		for (const rel of this.plugin.settings.relations) {
			for (const implied of rel.impliedRelations) {
				if (implied.targetRelation === oldName) {
					implied.targetRelation = newName;
				}
			}
		}
	}

	private removeImpliedRelationTargets(targetName: string) {
		for (const rel of this.plugin.settings.relations) {
			rel.impliedRelations = rel.impliedRelations.filter(
				(implied) => implied.targetRelation !== targetName
			);
		}
	}

	private updateGroupMemberRelations(oldName: string, newName: string) {
		if (!oldName || oldName === newName) {
			return;
		}
		for (const group of this.plugin.settings.groups) {
			for (const member of group.members) {
				if (member.relation === oldName) {
					member.relation = newName;
				}
			}
		}
	}

	private removeGroupMemberRelations(targetName: string) {
		for (const group of this.plugin.settings.groups) {
			group.members = group.members.filter((member) => member.relation !== targetName);
		}
	}
}
