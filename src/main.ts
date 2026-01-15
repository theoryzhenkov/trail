import {Plugin, TFile} from "obsidian";
import {DEFAULT_SETTINGS, TrailSettings, TrailSettingTab} from "./settings";
import {GraphStore} from "./graph/store";
import {TrailView, TRAIL_VIEW_TYPE} from "./ui/trail-view";
import {registerCommands} from "./commands";

export default class TrailPlugin extends Plugin {
	settings: TrailSettings;
	graph: GraphStore;
	private changedFiles: Set<string>;
	private refreshTimeoutId: number | null;

	async onload() {
		await this.loadSettings();

		this.graph = new GraphStore(this.app, this.settings);
		this.changedFiles = new Set();
		this.refreshTimeoutId = null;
		await this.graph.build();

		this.registerView(TRAIL_VIEW_TYPE, (leaf) => new TrailView(leaf, this));
		this.addSettingTab(new TrailSettingTab(this.app, this));
		registerCommands(this);

		this.registerEvent(this.app.metadataCache.on("changed", (file) => {
			if (file) {
				this.queueFileChange(file);
			}
		}));

		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			if (file instanceof TFile) {
				this.graph.handleRename(oldPath, file.path);
				this.refreshActiveView();
			}
		}));

		this.registerEvent(this.app.vault.on("delete", (file) => {
			if (file instanceof TFile) {
				this.graph.handleDelete(file.path);
				this.refreshActiveView();
			}
		}));

		this.registerEvent(this.app.workspace.on("file-open", () => {
			this.refreshActiveView();
		}));
	}

	onunload() {}

	refreshActiveView() {
		void this.graph.ensureFresh();
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
		this.graph.markAllStale();
		this.refreshActiveView();
	}

	private queueFileChange(file: TFile) {
		this.changedFiles.add(file.path);
		if (this.refreshTimeoutId !== null) {
			window.clearTimeout(this.refreshTimeoutId);
		}
		this.refreshTimeoutId = window.setTimeout(() => {
			this.flushFileChanges();
		}, 300);
	}

	private flushFileChanges() {
		for (const path of this.changedFiles) {
			this.graph.markFileStale(path);
		}
		this.changedFiles.clear();
		this.refreshActiveView();
	}
}
