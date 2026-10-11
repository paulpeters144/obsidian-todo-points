import { App, Plugin } from "obsidian";
import {
	Decoration,
	DecorationSet,
	EditorView,
	MatchDecorator,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
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
			return {
				type: "getChart",
				period: message.period,
				offset: message.offset,
			};
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

	async onload() {
		this.appManager = new AppManager({
			vaultAccess: new VaultAccess(this),
		});
		this.appManager.onEvent((event) => {
			this.broadcast(appEventToClientUpdate(event));
		});

		await this.appManager.dispatch({ type: "init" });

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
