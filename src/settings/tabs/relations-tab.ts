import {Notice, setIcon, Setting, SettingGroup} from "obsidian";
import TrailPlugin from "../../main";
import type {
	ImpliedRelation,
	RelationAlias,
	RelationDefinition,
	VisualDirection
} from "../../types";
import {isValidRelationName, normalizeRelationName} from "../validation";
import {createSectionDetails, IconSuggest, setupDragReorder} from "../components";
import {createDefaultAliases} from "../defaults";
import {getRelationDisplayName} from "../index";

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

	this.renderAddRelationControl(containerEl, openSections);
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
		const isNew = !relation.id;
		details.open = wasOpen || isNew;

		const displayName = getRelationDisplayName(relation);
		const nameSpan = summaryContent.createEl("span", {
			cls: "trail-relation-name",
			text: displayName || "(unnamed)"
		});
		if (!relation.id) {
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

		setupDragReorder(summary, details, index, this.plugin.settings.relations, () => {
			void this.plugin.saveSettings();
			this.display();
		});

		new Setting(content)
			.setName("ID")
			.setDesc("Unique lowercase identifier used in frontmatter and inline syntax (e.g., up, parent).")
			.addText((text) => {
				text
					.setPlaceholder("E.g., up, parent, contains")
					.setValue(relation.id)
					.onChange((value) => {
						const normalized = normalizeRelationName(value);
						if (value && !isValidRelationName(normalized)) {
							new Notice("Relation IDs must use lowercase letters, numbers, underscore, or dash.");
							text.setValue(relation.id);
							return;
						}
						if (normalized && this.isDuplicateRelationId(normalized, index)) {
							new Notice("Relation ID already exists.");
							text.setValue(relation.id);
							return;
						}
						const previousId = relation.id;
						relation.id = normalized;
						this.updateImpliedRelationTargets(previousId, normalized);
						this.updateGroupMemberRelations(previousId, normalized);
						void this.plugin.saveSettings();
						nameSpan.textContent = getRelationDisplayName(relation) || "(unnamed)";
						nameSpan.toggleClass("trail-relation-name-empty", !normalized);
					});
			});

		new Setting(content)
			.setName("Display name")
			.setDesc("Optional custom name shown in the UI. If empty, the ID is used.")
			.addText((text) => {
				text
					.setPlaceholder(relation.id || "Same as ID")
					.setValue(relation.displayName ?? "")
					.onChange((value) => {
						const trimmed = value.trim();
						relation.displayName = trimmed || undefined;
						void this.plugin.saveSettings();
						nameSpan.textContent = getRelationDisplayName(relation) || "(unnamed)";
					});
			});

		new Setting(content)
			.setName("Visual direction")
			.setDesc("How items are displayed: descending (indent increases) or ascending (indent decreases).")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("descending", "Descending (children)")
					.addOption("ascending", "Ascending (ancestors)")
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
						this.removeImpliedRelationTargets(relation.id);
						this.removeGroupMemberRelations(relation.id);
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
		new Setting(containerEl)
			.setName("Aliases")
			.setDesc("Frontmatter keys that map to this relation.");

		const itemsContainer = containerEl.createDiv({cls: "trail-items-list"});

		if (relation.aliases.length === 0) {
			itemsContainer.createEl("p", {text: "No aliases defined.", cls: "trail-empty-state"});
		} else {
			for (const [aliasIndex, alias] of relation.aliases.entries()) {
				this.renderAliasRow(itemsContainer, relation, alias, aliasIndex);
			}
		}

		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText("Add alias")
					.setCta()
					.onClick(() => {
						relation.aliases.push({
							key: relation.id || "key"
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
			.addText((text) => {
				text
					.setPlaceholder(relation.id || "key")
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
		new Setting(containerEl)
			.setName("Implied relations")
			.setDesc("Other relations that are automatically created when this relation exists.");

		const itemsContainer = containerEl.createDiv({cls: "trail-items-list"});

		if (relation.impliedRelations.length === 0) {
			itemsContainer.createEl("p", {text: "No implied relations.", cls: "trail-empty-state"});
		} else {
			for (const [impliedIndex, implied] of relation.impliedRelations.entries()) {
				this.renderImpliedRow(itemsContainer, relation, implied, impliedIndex);
			}
		}

		const options = this.getRelationOptions();
		if (options.length > 0) {
			new Setting(containerEl)
				.addButton((button) => {
					button
						.setButtonText("Add implied relation")
						.setCta()
						.onClick(() => {
							relation.impliedRelations.push({
								targetRelation: relation.id || (options[0] ?? ""),
								direction: "reverse"
							});
							void this.plugin.saveSettings();
							this.display();
						});
				});
		} else {
			containerEl.createEl("p", {
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
				const options = this.getRelationOptions();
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

	private getRelationOptions(): string[] {
		return this.plugin.settings.relations
			.map((r) => r.id)
			.filter((id) => id.length > 0);
	}

	private isDuplicateRelationId(id: string, currentIndex: number): boolean {
		return this.plugin.settings.relations.some((r, i) => i !== currentIndex && r.id === id);
	}

	private updateImpliedRelationTargets(oldId: string, newId: string) {
		if (!oldId || oldId === newId) {
			return;
		}
		for (const rel of this.plugin.settings.relations) {
			for (const implied of rel.impliedRelations) {
				if (implied.targetRelation === oldId) {
					implied.targetRelation = newId;
				}
			}
		}
	}

	private removeImpliedRelationTargets(targetId: string) {
		for (const rel of this.plugin.settings.relations) {
			rel.impliedRelations = rel.impliedRelations.filter(
				(implied) => implied.targetRelation !== targetId
			);
		}
	}

	private updateGroupMemberRelations(oldId: string, newId: string) {
		if (!oldId || oldId === newId) {
			return;
		}
		// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for legacy migration support
		for (const group of this.plugin.settings.groups) {
			for (const member of group.members) {
				if (member.relation === oldId) {
					member.relation = newId;
				}
			}
		}
	}

	private removeGroupMemberRelations(targetId: string) {
		// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional access for legacy migration support
		for (const group of this.plugin.settings.groups) {
			group.members = group.members.filter((member) => member.relation !== targetId);
		}
	}

	private renderAddRelationControl(containerEl: HTMLElement, openSections: Set<number>) {
		const setting = new Setting(containerEl)
			.setName("Add new relation")
			.setDesc("Create a relation type with standard aliases.");

		let newRelationId = "";

		setting
			.addText((text) => {
				text
					.setPlaceholder("E.g., parent, cites, related-to")
					.onChange((value) => {
						newRelationId = value;
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Create")
					.setCta()
					.onClick(() => {
						const normalized = normalizeRelationName(newRelationId);
						
						if (!normalized) {
							new Notice("Relation ID cannot be empty.");
							return;
						}
						
						if (!isValidRelationName(normalized)) {
							new Notice("Relation IDs must use lowercase letters, numbers, underscore, or dash.");
							return;
						}
						
						if (this.isDuplicateRelationId(normalized, -1)) {
							new Notice("Relation ID already exists.");
							return;
						}

						const newIndex = this.plugin.settings.relations.length;
						this.plugin.settings.relations.push({
							id: normalized,
							aliases: createDefaultAliases(normalized),
							impliedRelations: []
						});
						
						openSections.add(newIndex);
						void this.plugin.saveSettings();
						this.display();
					});
			});
	}
}
