import { Plugin } from "obsidian";
import { hasTasks } from "./access.tasks";

export interface VaultFileSnapshot {
	path: string;
	mtime: number;
	content: string;
}

export class VaultAccess {
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	private inFolder(path: string, folder: string): boolean {
		const trimmed = folder.replace(/^\/+|\/+$/g, "");
		if (trimmed === "") return true;
		return path === trimmed || path.startsWith(trimmed + "/");
	}

	async readMarkdownFolder(folder: string): Promise<VaultFileSnapshot[]> {
		const files = this.plugin.app.vault
			.getMarkdownFiles()
			.filter((f) => this.inFolder(f.path, folder));
		const snapshots: VaultFileSnapshot[] = [];
		for (const file of files) {
			const content = await this.plugin.app.vault.cachedRead(file);
			if (!hasTasks(content)) continue;
			snapshots.push({
				path: file.path,
				mtime: file.stat.mtime,
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
