import {Setting} from "obsidian";
import type {PropertySortKey, SortDirection} from "../../types";

export function renderSortKeyRow(
	containerEl: HTMLElement,
	sortKey: PropertySortKey,
	index: number,
	sortKeys: PropertySortKey[],
	onSave: () => void,
	onDisplay: () => void
): void {
	const setting = new Setting(containerEl);

	setting
		.addText((text) => {
			text
				.setPlaceholder("Property name")
				.setValue(sortKey.property)
				.onChange((value) => {
					sortKey.property = value.trim().toLowerCase();
					onSave();
				});
		})
		.addDropdown((dropdown) => {
			dropdown
				.addOption("asc", "Ascending (a→z)")
				.addOption("desc", "Descending (z→a)")
				.setValue(sortKey.direction)
				.onChange((value) => {
					sortKey.direction = value as SortDirection;
					onSave();
				});
		})
		.addExtraButton((button) => {
			button
				.setIcon("arrow-up")
				.setTooltip("Move up")
				.setDisabled(index === 0)
				.onClick(() => {
					const prev = sortKeys[index - 1];
					const curr = sortKeys[index];
					if (index > 0 && prev && curr) {
						sortKeys[index - 1] = curr;
						sortKeys[index] = prev;
						onSave();
						onDisplay();
					}
				});
		})
		.addExtraButton((button) => {
			button
				.setIcon("arrow-down")
				.setTooltip("Move down")
				.setDisabled(index === sortKeys.length - 1)
				.onClick(() => {
					const curr = sortKeys[index];
					const next = sortKeys[index + 1];
					if (index < sortKeys.length - 1 && curr && next) {
						sortKeys[index] = next;
						sortKeys[index + 1] = curr;
						onSave();
						onDisplay();
					}
				});
		})
		.addExtraButton((button) => {
			button
				.setIcon("trash")
				.setTooltip("Remove")
				.onClick(() => {
					sortKeys.splice(index, 1);
					onSave();
					onDisplay();
				});
		});
}
