import { Plugin } from "obsidian";

export interface TodoPointsSettings {
	listFolder: string;
}

export const DEFAULT_SETTINGS: TodoPointsSettings = {
	listFolder: "",
};

export class SettingsAccess {
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async load(): Promise<TodoPointsSettings> {
		const loaded = (await this.plugin.loadData()) as Partial<TodoPointsSettings> | null;
		return Object.assign({}, DEFAULT_SETTINGS, loaded);
	}

	async save(settings: TodoPointsSettings): Promise<void> {
		await this.plugin.saveData(settings);
	}
}
