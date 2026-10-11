import { Plugin } from "obsidian";
import { hasTasks } from "./access.tasks";

export interface VaultFileSnapshot {
	path: string;
	content: string;
}

export class VaultAccess {
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async readMarkdownFiles(): Promise<VaultFileSnapshot[]> {
		const files = this.plugin.app.vault.getMarkdownFiles();
		const snapshots: VaultFileSnapshot[] = [];
		for (const file of files) {
			const content = await this.plugin.app.vault.cachedRead(file);
			if (!hasTasks(content)) continue;
			snapshots.push({
				path: file.path,
				content,
			});
		}
		return snapshots;
	}

	onChange(callback: () => void): void {
		this.plugin.registerEvent(
			this.plugin.app.vault.on("modify", callback)
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on("create", callback)
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on("delete", callback)
		);
	}
}
