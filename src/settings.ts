import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import TrailPlugin from "./main";
import {ImpliedRule} from "./types";

export interface TrailSettings {
	impliedRules: ImpliedRule[];
}

export const DEFAULT_SETTINGS: TrailSettings = {
	impliedRules: [
		{baseRelation: "up", impliedRelation: "down", direction: "reverse"},
		{baseRelation: "down", impliedRelation: "up", direction: "reverse"},
		{baseRelation: "next", impliedRelation: "prev", direction: "reverse"},
		{baseRelation: "prev", impliedRelation: "next", direction: "reverse"}
	]
};

const RELATION_NAME_REGEX = /^[a-z0-9_-]+$/i;

export class TrailSettingTab extends PluginSettingTab {
	plugin: TrailPlugin;

	constructor(app: App, plugin: TrailPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		new Setting(containerEl).setName("Trail").setHeading();

		this.renderImpliedRules(containerEl);
	}

	private renderImpliedRules(containerEl: HTMLElement) {
		new Setting(containerEl).setName("Implied relations").setHeading();
		containerEl.createEl("p", {
			text: "Define implied relations between relation types."
		});

		const table = containerEl.createEl("table", {cls: "trail-implied-table"});
		const header = table.createEl("tr");
		header.createEl("th", {text: "Base relation"});
		header.createEl("th", {text: "Implied relation"});
		header.createEl("th", {text: "Direction"});
		header.createEl("th", {text: ""});

		for (const [index, rule] of this.plugin.settings.impliedRules.entries()) {
			this.renderRuleRow(table, rule, index);
		}

		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText("Add rule")
					.onClick(async () => {
						this.plugin.settings.impliedRules.push({
							baseRelation: "",
							impliedRelation: "",
							direction: "forward"
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderRuleRow(table: HTMLElement, rule: ImpliedRule, index: number) {
		const row = table.createEl("tr");

		const baseCell = row.createEl("td");
		const baseInput = baseCell.createEl("input", {
			type: "text",
			value: rule.baseRelation,
			placeholder: "up"
		});
		baseInput.addEventListener("change", () => {
			const value = baseInput.value.trim();
			if (!this.isValidRelationName(value)) {
				new Notice("Relation names must use letters, numbers, underscore, or dash.");
				baseInput.value = rule.baseRelation;
				return;
			}
			rule.baseRelation = value.toLowerCase();
			baseInput.value = rule.baseRelation;
			void this.plugin.saveSettings();
		});

		const impliedCell = row.createEl("td");
		const impliedInput = impliedCell.createEl("input", {
			type: "text",
			value: rule.impliedRelation,
			placeholder: "parent"
		});
		impliedInput.addEventListener("change", () => {
			const value = impliedInput.value.trim();
			if (!this.isValidRelationName(value)) {
				new Notice("Relation names must use letters, numbers, underscore, or dash.");
				impliedInput.value = rule.impliedRelation;
				return;
			}
			rule.impliedRelation = value.toLowerCase();
			impliedInput.value = rule.impliedRelation;
			void this.plugin.saveSettings();
		});

		const directionCell = row.createEl("td");
		const select = directionCell.createEl("select");
		const directions: ImpliedRule["direction"][] = ["forward", "reverse", "both"];
		for (const direction of directions) {
			const option = select.createEl("option", {
				value: direction,
				text: direction
			});
			if (direction === rule.direction) {
				option.selected = true;
			}
		}
		select.addEventListener("change", () => {
			rule.direction = select.value as ImpliedRule["direction"];
			void this.plugin.saveSettings();
		});

		const removeCell = row.createEl("td");
		const removeButton = removeCell.createEl("button", {text: "Remove"});
		removeButton.addEventListener("click", () => {
			this.plugin.settings.impliedRules.splice(index, 1);
			void this.plugin.saveSettings();
			this.display();
		});
	}

	private isValidRelationName(value: string) {
		if (value.length === 0) {
			return false;
		}
		return RELATION_NAME_REGEX.test(value);
	}
}
