import {Plugin, TFile} from "obsidian";
import {DEFAULT_SETTINGS, TrailSettings, TrailSettingTab, migrateSettingsIfNeeded} from "./settings";
import {GraphStore} from "./graph/store";
import {TrailView, TRAIL_VIEW_TYPE} from "./ui/trail-view";
import {registerCommands} from "./commands";
import {getCache} from "./query/cache";

export default class TrailPlugin extends Plugin {
	settings: TrailSettings;
	graph: GraphStore;
	private changedFiles: Set<string>;
	private refreshTimeoutId: number | null;
	private graphRefreshTimeoutId: number | null;

	async onload() {
		await this.loadSettings();

		this.graph = new GraphStore(this.app, this.settings);
		this.changedFiles = new Set();
		this.refreshTimeoutId = null;
		this.graphRefreshTimeoutId = null;

		this.registerView(TRAIL_VIEW_TYPE, (leaf) => new TrailView(leaf, this));
		this.addSettingTab(new TrailSettingTab(this.app, this));
		registerCommands(this);

		const unsubscribe = this.graph.onDidChange(() => {
			this.queueGraphRefresh();
		});
		this.register(() => unsubscribe());

		this.registerEvent(this.app.metadataCache.on("changed", (file) => {
			if (file) {
				this.queueFileChange(file);
			}
		}));

		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			if (file instanceof TFile) {
				this.graph.handleRename(oldPath, file.path);
				// Invalidate cache for both old and new paths
				const cache = getCache();
				cache.invalidateFile(oldPath);
				cache.invalidateFile(file.path);
			}
		}));

		this.registerEvent(this.app.vault.on("delete", (file) => {
			if (file instanceof TFile) {
				this.graph.handleDelete(file.path);
				// Invalidate cache for deleted file
				getCache().invalidateFile(file.path);
			}
		}));

		this.registerEvent(this.app.workspace.on("file-open", () => {
			this.refreshActiveView();
		}));

		// Wait for metadata cache to finish indexing before building graph
		this.registerEvent(this.app.metadataCache.on("resolved", () => {
			void this.onMetadataCacheReady();
		}));

		// Also handle case where cache is already resolved (plugin enabled after startup)
		this.app.workspace.onLayoutReady(() => {
			void this.onMetadataCacheReady();
		});
	}

	private async onMetadataCacheReady() {
		await this.graph.build();
		this.refreshActiveView();
	}

	onunload() {}

	refreshActiveView() {
		const leaves = this.app.workspace.getLeavesOfType(TRAIL_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof TrailView) {
				void view.refresh();
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<TrailSettings>);
		
		// Auto-migrate legacy groups to TQL format
		if (migrateSettingsIfNeeded(this.settings)) {
			await this.saveData(this.settings);
		}
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
		const cache = getCache();
		for (const path of this.changedFiles) {
			this.graph.markFileStale(path);
			// Invalidate cache for this file
			cache.invalidateFile(path);
		}
		// Also invalidate results for the active file since related files may have changed
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			cache.invalidateFile(activeFile.path);
		}
		this.changedFiles.clear();
		this.refreshActiveView();
	}

	private queueGraphRefresh() {
		if (this.graphRefreshTimeoutId !== null) {
			window.clearTimeout(this.graphRefreshTimeoutId);
		}
		this.graphRefreshTimeoutId = window.setTimeout(() => {
			this.graphRefreshTimeoutId = null;
			this.refreshActiveView();
		}, 150);
	}
}
