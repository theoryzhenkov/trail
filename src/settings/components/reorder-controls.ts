import {setIcon} from "obsidian";

export function renderReorderControls<T>(
	containerEl: HTMLElement,
	index: number,
	array: T[],
	onReorder: () => void
): void {
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
				onReorder();
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
				onReorder();
			}
		}
	});
}
