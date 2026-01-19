import {AbstractInputSuggest, App, getIconIds, setIcon} from "obsidian";

export class IconSuggest extends AbstractInputSuggest<string> {
	private onSelectCallback: (iconId: string) => void;
	private textInputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement, onSelect: (iconId: string) => void) {
		super(app, inputEl);
		this.textInputEl = inputEl;
		this.onSelectCallback = onSelect;
	}

	getSuggestions(inputStr: string): string[] {
		const allIcons = getIconIds();
		const lower = inputStr.toLowerCase().trim();

		if (!lower) {
			// Show some common/popular icons when empty
			return allIcons.slice(0, 50);
		}

		return allIcons
			.filter(icon => {
				const iconLower = icon.toLowerCase();
				const withoutPrefix = iconLower.replace(/^lucide-/, "");
				return iconLower.includes(lower) || withoutPrefix.includes(lower);
			})
			.slice(0, 50);
	}

	renderSuggestion(iconId: string, el: HTMLElement): void {
		el.addClass("trail-icon-suggestion");

		const iconEl = el.createSpan({cls: "trail-icon-suggestion-icon"});
		setIcon(iconEl, iconId);

		const displayName = iconId.replace(/^lucide-/, "");
		el.createSpan({cls: "trail-icon-suggestion-text", text: displayName});
	}

	selectSuggestion(iconId: string, _evt: MouseEvent | KeyboardEvent): void {
		this.textInputEl.value = iconId;
		this.textInputEl.dispatchEvent(new Event("input"));
		this.onSelectCallback(iconId);
		this.close();
	}
}
