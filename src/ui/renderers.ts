import {App, TFile, setIcon} from "obsidian";
import type {FileProperties} from "../types";

/**
 * Renders an empty state with icon, title, and description.
 */
export function renderEmptyState(
	containerEl: HTMLElement,
	icon: string,
	title: string,
	description: string
): HTMLElement {
	const emptyEl = containerEl.createDiv({cls: "trail-empty-state"});
	const iconEl = emptyEl.createDiv({cls: "trail-empty-icon"});
	setIcon(iconEl, icon);
	emptyEl.createDiv({cls: "trail-empty-title", text: title});
	emptyEl.createDiv({cls: "trail-empty-description", text: description});
	return emptyEl;
}

/**
 * Renders a clickable internal link to a file.
 */
export function renderFileLink(
	containerEl: HTMLElement,
	app: App,
	path: string
): HTMLAnchorElement {
	const file = app.vault.getAbstractFileByPath(path);
	const label = file instanceof TFile ? file.basename : path;
	const link = containerEl.createEl("a", {
		text: label, 
		cls: "internal-link",
		attr: {"data-path": path}
	});
	link.addEventListener("click", (e) => {
		e.preventDefault();
		void app.workspace.openLinkText(path, "", false);
	});
	return link;
}

/**
 * Renders property badges from file properties.
 */
export function renderPropertyBadges(
	containerEl: HTMLElement,
	properties: FileProperties | undefined,
	displayProperties: string[]
): HTMLElement | null {
	if (!properties || displayProperties.length === 0) {
		return null;
	}

	const badges = formatPropertyBadges(properties, displayProperties);
	if (badges.length === 0) {
		return null;
	}

	const badgesEl = containerEl.createDiv({cls: "trail-property-badges"});
	for (const badge of badges) {
		badgesEl.createSpan({cls: "trail-property-badge", text: badge});
	}
	return badgesEl;
}

/**
 * Formats properties into badge strings.
 */
export function formatPropertyBadges(
	properties: FileProperties,
	displayProperties: string[]
): string[] {
	const badges: string[] = [];
	for (const rawKey of displayProperties) {
		const key = rawKey.trim().toLowerCase();
		if (!key) {
			continue;
		}
		const value = properties[key];
		if (value === undefined) {
			continue;
		}
		badges.push(formatPropertyValue(key, value));
	}
	return badges;
}

/**
 * Formats a single property value for display.
 */
function formatPropertyValue(key: string, value: FileProperties[string]): string {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return "";
		}
		return `${key}: ${value.join(", ")}`;
	}
	if (value === null) {
		return `${key}: null`;
	}
	if (typeof value === "object") {
		return `${key}: ${JSON.stringify(value)}`;
	}
	return `${key}: ${String(value)}`;
}

export interface CollapsibleSection {
	sectionEl: HTMLElement;
	headerEl: HTMLElement;
	contentEl: HTMLElement;
}

/**
 * Creates a collapsible section with header and content area.
 */
export function createCollapsibleSection(
	containerEl: HTMLElement, 
	title: string, 
	icon: string,
	count?: number
): CollapsibleSection {
	const sectionEl = containerEl.createDiv({cls: "tree-item trail-section"});
	
	const headerEl = sectionEl.createDiv({cls: "tree-item-self trail-section-header is-clickable"});
	
	const collapseIcon = headerEl.createDiv({cls: "tree-item-icon collapse-icon"});
	setIcon(collapseIcon, "chevron-down");
	
	const iconEl = headerEl.createSpan({cls: "trail-section-icon"});
	setIcon(iconEl, icon);
	
	const titleEl = headerEl.createSpan({cls: "tree-item-inner trail-section-title"});
	titleEl.setText(title);
	
	if (count !== undefined && count > 0) {
		const countEl = headerEl.createSpan({cls: "tree-item-flair"});
		countEl.createSpan({cls: "tree-item-flair-text", text: String(count)});
	}
	
	const contentEl = sectionEl.createDiv({cls: "tree-item-children trail-section-content"});
	
	// Collapse/expand functionality
	let isCollapsed = false;
	headerEl.addEventListener("click", () => {
		isCollapsed = !isCollapsed;
		sectionEl.toggleClass("is-collapsed", isCollapsed);
		collapseIcon.toggleClass("is-collapsed", isCollapsed);
	});
	
	return {sectionEl, headerEl, contentEl};
}
