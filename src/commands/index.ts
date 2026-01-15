import TrailPlugin from "../main";
import {TRAIL_VIEW_TYPE} from "../ui/trail-view";

export function registerCommands(plugin: TrailPlugin) {
	plugin.addCommand({
		id: "trail-open-pane",
		name: "Open trail pane",
		callback: async () => {
			await activateTrailView(plugin);
		}
	});

	plugin.addCommand({
		id: "trail-refresh-graph",
		name: "Refresh trail graph",
		callback: async () => {
			await plugin.graph.build();
			plugin.refreshActiveView();
		}
	});
}

async function activateTrailView(plugin: TrailPlugin) {
	const leaves = plugin.app.workspace.getLeavesOfType(TRAIL_VIEW_TYPE);
	const existingLeaf = leaves[0];
	if (existingLeaf) {
		void plugin.app.workspace.revealLeaf(existingLeaf);
		return;
	}

	const leaf = plugin.app.workspace.getRightLeaf(false);
	if (!leaf) {
		return;
	}
	await leaf.setViewState({type: TRAIL_VIEW_TYPE, active: true});
}
