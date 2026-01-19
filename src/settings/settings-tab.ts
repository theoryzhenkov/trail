import {App, PluginSettingTab} from "obsidian";
import type {EditorView} from "@codemirror/view";
import TrailPlugin from "../main";
import {GroupsTabRenderer, RelationsTabRenderer} from "./tabs";

type SettingsTab = "relations" | "groups";

export class TrailSettingTab extends PluginSettingTab {
	plugin: TrailPlugin;
	private openRelationSections: Set<number> = new Set();
	private openGroupSections: Set<number> = new Set();
	private editorViews = new Map<number, EditorView>();
	private activeTab: SettingsTab = "relations";
	private relationsRenderer: RelationsTabRenderer;
	private groupsRenderer: GroupsTabRenderer;

	constructor(app: App, plugin: TrailPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.relationsRenderer = new RelationsTabRenderer(plugin, () => this.display());
		this.groupsRenderer = new GroupsTabRenderer(plugin, () => this.display(), this.editorViews);
	}

	display(): void {
		const {containerEl} = this;

		this.saveOpenState(containerEl);
		this.groupsRenderer.cleanup();

		containerEl.empty();
		containerEl.addClass("trail-settings");

		this.renderTabNavigation(containerEl);
		this.renderTabContent(containerEl);
	}

	private renderTabNavigation(containerEl: HTMLElement) {
		const tabNav = containerEl.createDiv({cls: "trail-settings-tabs"});

		const relationsTab = tabNav.createDiv({
			cls: `trail-settings-tab ${this.activeTab === "relations" ? "is-active" : ""}`,
			text: "Relations"
		});
		relationsTab.addEventListener("click", () => {
			if (this.activeTab !== "relations") {
				this.activeTab = "relations";
				this.display();
			}
		});

		const groupsTab = tabNav.createDiv({
			cls: `trail-settings-tab ${this.activeTab === "groups" ? "is-active" : ""}`,
			text: "Groups"
		});
		groupsTab.addEventListener("click", () => {
			if (this.activeTab !== "groups") {
				this.activeTab = "groups";
				this.display();
			}
		});
	}

	private renderTabContent(containerEl: HTMLElement) {
		const content = containerEl.createDiv({cls: "trail-settings-content"});

		if (this.activeTab === "relations") {
			this.relationsRenderer.render(content, this.openRelationSections);
		} else {
			this.groupsRenderer.render(content, this.openGroupSections);
		}
	}

	private saveOpenState(containerEl: HTMLElement) {
		this.openRelationSections = this.relationsRenderer.saveOpenState(containerEl);
		this.openGroupSections = this.groupsRenderer.saveOpenState(containerEl);
	}
}
