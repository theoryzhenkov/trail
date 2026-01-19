import {Setting} from "obsidian";
import type {PropertyFilter} from "../../types";

export function renderPropertyFilterRow(
	containerEl: HTMLElement,
	filter: PropertyFilter,
	onDelete: () => void,
	onSave: () => void
): void {
	const setting = new Setting(containerEl);

	setting
		.addText((text) => {
			text
				.setPlaceholder("Property key")
				.setValue(filter.key)
				.onChange((value) => {
					filter.key = value.trim().toLowerCase();
					onSave();
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
					onSave();
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
					onSave();
				});
		})
		.addExtraButton((button) => {
			button
				.setIcon("trash")
				.setTooltip("Remove")
				.onClick(onDelete);
		});
}
