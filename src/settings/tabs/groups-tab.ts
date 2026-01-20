import type {EditorView} from "@codemirror/view";
import {Notice, Setting, SettingGroup} from "obsidian";
import TrailPlugin from "../../main";
import {
	GroupDefinition,
	RelationGroup
} from "../../types";
import {parse, TQLError} from "../../query";
import {migrateGroup} from "../../query/migration";
import {createTQLEditor} from "../../query/codemirror";
import {hasLegacyGroups, EditorMode} from "../index";
import {isVisualEditable, parseToVisual, visualToQuery, VisualCondition, VisualQuery} from "../visual-editor";
import {
	createSectionDetails,
	renderReorderControls
} from "../components";

export class GroupsTabRenderer {
	private plugin: TrailPlugin;
	private display: () => void;
	private editorViews: Map<number, EditorView>;

	constructor(plugin: TrailPlugin, display: () => void, editorViews: Map<number, EditorView>) {
		this.plugin = plugin;
		this.display = display;
		this.editorViews = editorViews;
	}

	cleanup(): void {
		for (const view of this.editorViews.values()) {
			view.destroy();
		}
		this.editorViews.clear();
	}

	saveOpenState(containerEl: HTMLElement): Set<number> {
		const details = containerEl.querySelectorAll<HTMLDetailsElement>(".trail-group-section");
		const openSections = new Set<number>();
		details.forEach((el, index) => {
			if (el.open) {
				openSections.add(index);
			}
		});
		return openSections;
	}

	render(containerEl: HTMLElement, openGroupSections: Set<number>): void {
		new SettingGroup(containerEl)
			.setHeading("Options")
			.addSetting((setting) => {
				setting
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
			})
			.addSetting((setting) => {
				setting
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
			});

		if (hasLegacyGroups(this.plugin.settings)) {
			this.renderMigrationBanner(containerEl);
		}

		new SettingGroup(containerEl)
			.setHeading("TQL groups")
			.addSetting((setting) => {
				setting.setDesc("Configure relation groups shown in the trail pane using TQL queries.");
			});

		for (const [index, group] of this.plugin.settings.tqlGroups.entries()) {
			this.renderTqlGroupSection(containerEl, group, index, openGroupSections);
		}

		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText("Add group")
					.setCta()
					.onClick(() => {
						const newIndex = this.plugin.settings.tqlGroups.length;
						this.plugin.settings.tqlGroups.push({
							query: `group "New group"\nfrom up`,
							enabled: true,
						});
						openGroupSections.add(newIndex);
						void this.plugin.saveSettings();
						this.display();
					});
			});

		if (hasLegacyGroups(this.plugin.settings)) {
			this.renderLegacyGroupsSection(containerEl);
		}
	}

	private renderMigrationBanner(containerEl: HTMLElement) {
		const banner = containerEl.createDiv({cls: "trail-migration-banner"});

		new Setting(banner)
			.setName("Legacy groups detected")
			.setDesc("Your configuration includes legacy groups. Click 'Migrate' on each group below to convert them to TQL format.")
			.setHeading();
	}

	private renderTqlGroupSection(
		containerEl: HTMLElement,
		group: GroupDefinition,
		index: number,
		openGroupSections: Set<number>
	) {
		const {details, summary, summaryContent, content} = createSectionDetails(
			containerEl,
			"trail-relation-section trail-group-section trail-tql-group"
		);
		const wasOpen = openGroupSections.has(index);
		details.open = wasOpen;

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

		renderReorderControls(summary, index, this.plugin.settings.tqlGroups, () => {
			void this.plugin.saveSettings();
			this.display();
		});

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

		const editorMode = this.plugin.settings.editorMode ?? "auto";
		const canVisualEdit = isVisualEditable(group.query);
		const showVisual = editorMode === "visual" || (editorMode === "auto" && canVisualEdit);

		const errorContainer = content.createDiv({cls: "trail-query-error"});

		if (showVisual && canVisualEdit) {
			this.renderVisualEditor(content, group, index, nameSpan, errorContainer);
		} else {
			this.renderQueryEditor(content, group, index, nameSpan, errorContainer);
		}

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
							const newMode: EditorMode = showVisual ? "query" : "visual";
							this.plugin.settings.editorMode = newMode;
							void this.plugin.saveSettings();
							this.display();
						});
				});
		}

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
		index: number,
		nameSpan: HTMLElement,
		errorContainer: HTMLElement
	) {
		new Setting(content)
			.setName("Query")
			.setDesc("TQL query defining this group.");

		const editorContainer = content.createDiv({cls: "trail-codemirror-container"});

		const editorView = createTQLEditor({
			doc: group.query,
			parent: editorContainer,
			onChange: (value) => {
				group.query = value;
				this.validateQuery(value, errorContainer, nameSpan);
				void this.plugin.saveSettings();
			},
			getRelationNames: () => this.plugin.settings.relations.map(r => r.name),
			minHeight: "120px",
		});

		this.editorViews.set(index, editorView);

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
			this.renderQueryEditor(content, group, index, nameSpan, errorContainer);
			return;
		}

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

		const relationsContainer = content.createDiv({cls: "trail-visual-relations"});
		new Setting(relationsContainer)
			.setName("Relations")
			.setDesc("Relations to traverse.")
			.setHeading();

		for (const [i, rel] of visual.relations.entries()) {
			const relEl = relationsContainer.createDiv({cls: "trail-visual-relation"});

			new Setting(relEl)
				.addDropdown((dropdown) => {
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
					text.inputEl.addClass("trail-depth-input");
				})
				.addExtraButton((btn) => {
					btn
						.setIcon("x")
						.setTooltip("Remove relation")
						.onClick(() => {
							visual.relations.splice(i, 1);
							if (visual.relations.length === 0) {
								visual.relations.push({name: "up", depth: "unlimited"});
							}
							this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
							this.display();
						});
				});
		}

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

		this.renderVisualCondition(content, visual, group, nameSpan, errorContainer, {
			field: "when",
			title: "Show when",
			description: "Only show this group when the current note matches this condition (optional).",
			emptyDescription: "No condition set. Group always visible.",
		});

		this.renderVisualCondition(content, visual, group, nameSpan, errorContainer, {
			field: "where",
			title: "Filter results",
			description: "Only include results where this condition is true (optional).",
			emptyDescription: "No filter set. All results shown.",
		});

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

	private renderVisualCondition(
		content: HTMLElement,
		visual: VisualQuery,
		group: GroupDefinition,
		nameSpan: HTMLElement,
		errorContainer: HTMLElement,
		options: {
			field: "when" | "where";
			title: string;
			description: string;
			emptyDescription: string;
		}
	) {
		const section = content.createDiv({cls: `trail-visual-${options.field}`});

		new Setting(section)
			.setName(options.title)
			.setDesc(options.description)
			.setHeading();

		const condition = visual[options.field];
		const hasCondition = Boolean(condition);

		if (hasCondition && condition) {
			const conditionEl = section.createDiv({cls: "trail-visual-condition"});
			const isExistenceCheck = condition.operator === "exists" || condition.operator === "notExists";

			new Setting(conditionEl)
				.addText((text) => {
					text
						.setValue(condition.property ?? "")
						.setPlaceholder("Property")
						.onChange((value) => {
							condition.property = value;
							this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
						});
				})
				.addDropdown((dropdown) => {
					dropdown
						.addOption("exists", "exists")
						.addOption("notExists", "not exists")
						.addOption("=", "=")
						.addOption("!=", "!=")
						.addOption("<", "<")
						.addOption(">", ">")
						.addOption("<=", "<=")
						.addOption(">=", ">=")
						.addOption("contains", "contains")
						.setValue(condition.operator ?? "exists")
						.onChange((value) => {
							condition.operator = value as VisualCondition["operator"];
							if (value === "exists" || value === "notExists") {
								condition.value = undefined;
							}
							this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
							this.display();
						});
				})
				.addText((text) => {
					const valueStr = condition.value === undefined ? "" : String(condition.value);
					text
						.setValue(valueStr)
						.setPlaceholder("Value")
						.setDisabled(isExistenceCheck)
						.onChange((value) => {
							if (value === "true") {
								condition.value = true;
							} else if (value === "false") {
								condition.value = false;
							} else if (!isNaN(Number(value)) && value.trim() !== "") {
								condition.value = Number(value);
							} else {
								condition.value = value;
							}
							this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
						});
				})
				.addExtraButton((btn) => {
					btn
						.setIcon("x")
						.setTooltip("Remove condition")
						.onClick(() => {
							if (options.field === "when") {
								visual.when = undefined;
							} else {
								visual.where = undefined;
							}
							this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
							this.display();
						});
				});
		} else {
			new Setting(section)
				.setDesc(options.emptyDescription)
				.addButton((btn) => {
					btn
						.setButtonText("Add condition")
						.onClick(() => {
							const newCondition: VisualCondition = {property: "type", operator: "exists"};
							if (options.field === "when") {
								visual.when = newCondition;
							} else {
								visual.where = newCondition;
							}
							this.updateGroupFromVisual(group, visual, nameSpan, errorContainer);
							this.display();
						});
				});
		}
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

		const migrateBtn = actions.createEl("button", {text: "Migrate to TQL", cls: "mod-cta"});
		migrateBtn.addEventListener("click", () => {
			const tqlGroup = migrateGroup(group);
			this.plugin.settings.tqlGroups.push(tqlGroup);
			this.plugin.settings.groups.splice(index, 1);
			void this.plugin.saveSettings();
			new Notice(`Migrated "${group.name}" to TQL`);
			this.display();
		});

		const deleteBtn = actions.createEl("button", {text: "Delete", cls: "mod-warning"});
		deleteBtn.addEventListener("click", () => {
			this.plugin.settings.groups.splice(index, 1);
			void this.plugin.saveSettings();
			this.display();
		});

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
}
