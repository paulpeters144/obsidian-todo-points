import { Notice, Plugin } from "obsidian";

interface TodoCompletion {
	text: string;
	path: string;
	completedAt: number;
}

interface TodoPointsSettings {
	completions: TodoCompletion[];
}

const DEFAULT_SETTINGS: TodoPointsSettings = {
	completions: [],
};

export default class TodoPointsPlugin extends Plugin {
	settings: TodoPointsSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("checkmark", "Todo Points", () => {
			this.showPoints();
		});

		this.addCommand({
			id: "show-todo-points",
			name: "Show todo points",
			callback: () => this.showPoints(),
		});
	}

	showPoints() {
		const total = this.settings.completions.length;
		new Notice(`Completed todos: ${total}`);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
