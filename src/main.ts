import {Plugin} from "obsidian";
import {DEFAULT_SETTINGS, TrailSettings, TrailSettingTab} from "./settings";
import {GraphStore} from "./graph/store";
import {TrailView, TRAIL_VIEW_TYPE} from "./ui/trail-view";
import {registerCommands} from "./commands";

export default class TrailPlugin extends Plugin {
	settings: TrailSettings;
	graph: GraphStore;

	async onload() {
		await this.loadSettings();

		this.graph = new GraphStore(this.app, this.settings);
		await this.graph.build();

		this.registerView(TRAIL_VIEW_TYPE, (leaf) => new TrailView(leaf, this));
		this.addSettingTab(new TrailSettingTab(this.app, this));
		registerCommands(this);

		this.registerEvent(this.app.metadataCache.on("changed", async (file) => {
			if (file) {
				await this.graph.updateFile(file);
				this.refreshActiveView();
			}
		}));

		this.registerEvent(this.app.workspace.on("file-open", () => {
			this.refreshActiveView();
		}));
	}

	onunload() {}

	refreshActiveView() {
		const leaves = this.app.workspace.getLeavesOfType(TRAIL_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof TrailView) {
				view.refresh();
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<TrailSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.graph.updateSettings(this.settings);
		this.refreshActiveView();
	}
}
