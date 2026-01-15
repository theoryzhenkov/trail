import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import TrailPlugin from "./main";
import {ImpliedRelation, RelationAlias, RelationAliasType, RelationDefinition} from "./types";

export interface TrailSettings {
	relations: RelationDefinition[];
}

const RELATION_NAME_REGEX = /^[a-z0-9_-]+$/i;
export const DEFAULT_SETTINGS: TrailSettings = {
	relations: createDefaultRelations()
};

export class TrailSettingTab extends PluginSettingTab {
	plugin: TrailPlugin;
	private openSections: Set<number> = new Set();

	constructor(app: App, plugin: TrailPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		// Save current open state before clearing
		this.saveOpenState(containerEl);

		containerEl.empty();
		containerEl.addClass("trail-settings");

		this.renderRelations(containerEl);
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
						void this.plugin.saveSettings();
						// Update just the summary name
						nameSpan.textContent = normalized || "(unnamed)";
						nameSpan.toggleClass("trail-relation-name-empty", !normalized);
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
}

function createDefaultRelations(): RelationDefinition[] {
	const base = ["up", "down", "next", "prev"];
	const relations = base.map((name) => ({
		name,
		aliases: createDefaultAliases(name),
		impliedRelations: [] as ImpliedRelation[]
	}));

	const impliedPairs: Array<[string, string]> = [
		["up", "down"],
		["down", "up"],
		["next", "prev"],
		["prev", "next"]
	];

	for (const [from, to] of impliedPairs) {
		const relation = relations.find((item) => item.name === from);
		if (!relation) {
			continue;
		}
		relation.impliedRelations.push({
			targetRelation: to,
			direction: "reverse"
		});
	}

	return relations;
}

function createDefaultAliases(name: string): RelationAlias[] {
	return [
		{type: "property", key: name},
		{type: "dotProperty", key: `relations.${name}`},
		{type: "relationsMap", key: name}
	];
}

function normalizeRelationName(name: string): string {
	return name.trim().toLowerCase();
}

function isValidRelationName(value: string) {
	if (value.length === 0) {
		return false;
	}
	return RELATION_NAME_REGEX.test(value);
}
