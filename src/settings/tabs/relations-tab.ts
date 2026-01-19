import {Notice, setIcon, Setting, SettingGroup} from "obsidian";
import TrailPlugin from "../../main";
import type {
	ImpliedRelation,
	RelationAlias,
	RelationAliasType,
	RelationDefinition,
	VisualDirection
} from "../../types";
import {isValidRelationName, normalizeRelationName} from "../validation";
import {createSectionDetails, IconSuggest, renderReorderControls} from "../components";

export class RelationsTabRenderer {
	private plugin: TrailPlugin;
	private display: () => void;

	constructor(plugin: TrailPlugin, display: () => void) {
		this.plugin = plugin;
		this.display = display;
	}

	saveOpenState(containerEl: HTMLElement): Set<number> {
		const details = containerEl.querySelectorAll<HTMLDetailsElement>(".trail-relation-section");
		const openSections = new Set<number>();
		details.forEach((el, index) => {
			if (el.open) {
				openSections.add(index);
			}
		});
		return openSections;
	}

	render(containerEl: HTMLElement, openSections: Set<number>): void {
		new SettingGroup(containerEl)
			.setHeading("Relations")
			.addSetting((setting) => {
				setting.setDesc("Define relation types and their aliases.");
			});

		for (const [index, relation] of this.plugin.settings.relations.entries()) {
			this.renderRelationSection(containerEl, relation, index, openSections);
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
						openSections.add(newIndex);
						void this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderRelationSection(
		containerEl: HTMLElement,
		relation: RelationDefinition,
		index: number,
		openSections: Set<number>
	) {
		const {details, summary, summaryContent, content} = createSectionDetails(
			containerEl,
			"trail-relation-section"
		);

		const wasOpen = openSections.has(index);
		const isNew = !relation.name;
		details.open = wasOpen || isNew;

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

		renderReorderControls(summary, index, this.plugin.settings.relations, () => {
			void this.plugin.saveSettings();
			this.display();
		});

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
						nameSpan.textContent = normalized || "(unnamed)";
						nameSpan.toggleClass("trail-relation-name-empty", !normalized);
					});
			});

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

		this.renderIconSetting(content, relation);

		this.renderAliasesSubsection(content, relation);
		this.renderImpliedSubsection(content, relation);

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

	private renderIconSetting(containerEl: HTMLElement, relation: RelationDefinition) {
		const setting = new Setting(containerEl)
			.setName("Icon")
			.setDesc("Optional Lucide icon name to display instead of the relation name. Start typing to search.");

		// Create preview element
		const previewEl = setting.controlEl.createSpan({cls: "trail-icon-preview"});
		if (relation.icon) {
			setIcon(previewEl, relation.icon);
		}

		const updatePreview = (iconName: string) => {
			previewEl.empty();
			if (iconName) {
				setIcon(previewEl, iconName);
			}
		};

		setting.addText((text) => {
			text
				.setPlaceholder("Search icons...")
				.setValue(relation.icon ?? "");

			// Attach icon suggester
			new IconSuggest(this.plugin.app, text.inputEl, (iconId) => {
				relation.icon = iconId || undefined;
				updatePreview(iconId);
				void this.plugin.saveSettings();
			});

			text.onChange((value) => {
				const trimmed = value.trim().toLowerCase();
				relation.icon = trimmed || undefined;
				updatePreview(trimmed);
				void this.plugin.saveSettings();
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

	private renderAliasRow(
		containerEl: HTMLElement,
		relation: RelationDefinition,
		alias: RelationAlias,
		index: number
	) {
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

				let currentValue = alias.key;

				text.onChange((value) => {
					currentValue = value;
				});

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
