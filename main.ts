import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
} from "obsidian";
import {
	Decoration,
	DecorationSet,
	EditorView,
	MatchDecorator,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import { SettingsAccess } from "./src/access.settings";
import { VaultAccess } from "./src/access.vault";
import {
	AppEvent,
	AppManager,
	AppRequest,
	AppResponse,
} from "./src/manager.app";
import {
	ClientMessage,
	ClientUpdate,
	TodoPointsView,
	VIEW_TYPE_TODO_POINTS,
} from "./src/client.view";

const TAG_RE = /#p\d+\b/gi;

const tagDecorator = new MatchDecorator({
	regexp: TAG_RE,
	decoration: Decoration.mark({ class: "todo-points-tag" }),
});

class TagHighlighter {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = tagDecorator.createDeco(view);
	}

	update(update: ViewUpdate) {
		this.decorations = tagDecorator.updateDeco(update, this.decorations);
	}
}

const tagHighlighter = ViewPlugin.fromClass(TagHighlighter, {
	decorations: (v) => v.decorations,
});

function toAppRequest(message: ClientMessage): AppRequest {
	switch (message.type) {
		case "query":
			return { type: "getChart", period: message.period };
	}
}

function toClientUpdate(response: AppResponse): ClientUpdate | null {
	switch (response.type) {
		case "chart":
			return {
				type: "render",
				stats: response.stats,
				chart: response.chart,
			};
		default:
			return null;
	}
}

function appEventToClientUpdate(event: AppEvent): ClientUpdate {
	switch (event.type) {
		case "dataChanged":
			return { type: "refresh" };
	}
}

export default class TodoPointsPlugin extends Plugin {
	private appManager!: AppManager;
	private listFolder = "example-lists";

	async onload() {
		this.appManager = new AppManager({
			settingsAccess: new SettingsAccess(this),
			vaultAccess: new VaultAccess(this),
		});
		this.appManager.onEvent((event) => {
			this.broadcast(appEventToClientUpdate(event));
		});

		const ready = await this.appManager.dispatch({ type: "init" });
		if (ready.type === "ready") this.listFolder = ready.folder;

		this.registerView(
			VIEW_TYPE_TODO_POINTS,
			(leaf) =>
				new TodoPointsView(leaf, (message) =>
					this.handleClientMessage(message)
				)
		);

		this.addRibbonIcon("list-todo", "Todo points", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open",
			name: "Open dashboard",
			callback: () => this.activateView(),
		});

		this.addSettingTab(new TodoPointsSettingTab(this.app, this));

		this.registerEditorExtension(tagHighlighter);

		this.registerMarkdownPostProcessor((el) => {
			el.querySelectorAll("a.tag").forEach((tag) => {
				if (/^#p\d+$/i.test(tag.getText())) {
					tag.addClass("todo-points-tag");
				}
			});
		});
	}

	private async handleClientMessage(
		message: ClientMessage
	): Promise<ClientUpdate | null> {
		const response = await this.appManager.dispatch(
			toAppRequest(message)
		);
		return toClientUpdate(response);
	}

	private broadcast(update: ClientUpdate) {
		for (const leaf of this.app.workspace.getLeavesOfType(
			VIEW_TYPE_TODO_POINTS
		)) {
			const view = leaf.view;
			if (view instanceof TodoPointsView) view.receive(update);
		}
	}

	getListFolder(): string {
		return this.listFolder;
	}

	async setListFolder(folder: string): Promise<void> {
		const response = await this.appManager.dispatch({
			type: "setFolder",
			folder,
		});
		if (response.type === "folderSaved") this.listFolder = response.folder;
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_TODO_POINTS)[0];
		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (!rightLeaf) return;
			await rightLeaf.setViewState({
				type: VIEW_TYPE_TODO_POINTS,
				active: true,
			});
			leaf = rightLeaf;
		}
		await workspace.revealLeaf(leaf);
	}
}

class TodoPointsSettingTab extends PluginSettingTab {
	plugin: TodoPointsPlugin;

	constructor(app: App, plugin: TodoPointsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Lists folder",
				desc: "Folder of markdown lists to read todos from. Tasks are checkbox lines; points come from a #pN tag anywhere in the line (e.g. #p5 = 5 points). Any other #tag on the line (e.g. #house, #game) names a project the points count toward. A date (year, month, and day) on a line above a list sets the completion day for its tasks.",
				control: {
					type: "folder",
					key: "listFolder",
					placeholder: "example-lists",
				},
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === "listFolder") return this.plugin.getListFolder();
		return undefined;
	}

	setControlValue(key: string, value: unknown): void | Promise<void> {
		if (key === "listFolder") {
			return this.plugin.setListFolder(String(value).trim());
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Lists folder")
			.setDesc(
				"Folder of markdown lists to read todos from. Tasks are checkbox lines; points come from a #pN tag anywhere in the line (e.g. #p5 = 5 points). Any other #tag on the line (e.g. #house, #game) names a project the points count toward. A date (year, month, and day) on a line above a list sets the completion day for its tasks."
			)
			.addText((text) =>
				text
					.setPlaceholder("example-lists")
					.setValue(this.plugin.getListFolder())
					.onChange(async (value) => {
						await this.plugin.setListFolder(value.trim());
					})
			);
	}
}
