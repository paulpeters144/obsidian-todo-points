# Views

Custom views let your plugin display content in a pane, just like the file
explorer or graph view. You create a class extending `ItemView`, register it
with `registerView`, and activate it via `workspace`.

## Defining a view

```ts
import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_EXAMPLE = "example-view";

export class ExampleView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_EXAMPLE;
	}

	getDisplayText(): string {
		return "Example view";
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.createEl("h4", { text: "Example view" });
		container.createEl("p", { text: "Hello from a custom view!" });
	}

	async onClose() {
		// Clean up anything the view holds that isn't tied to the DOM.
	}
}
```

- `getViewType()` returns a unique string identifying the view type.
- `getDisplayText()` is the title shown in the tab/header.
- `onOpen()` builds the UI into `this.contentEl`.
- `onClose()` handles cleanup for resources not tied to the DOM.

## Registering and activating

Register the view in `onload`, and activate it by setting leaf state:

```ts
import { Plugin, WorkspaceLeaf } from "obsidian";
import { ExampleView, VIEW_TYPE_EXAMPLE } from "./view";

export default class MyPlugin extends Plugin {
	async onload() {
		this.registerView(
			VIEW_TYPE_EXAMPLE,
			(leaf) => new ExampleView(leaf)
		);

		this.addRibbonIcon("dice", "Activate view", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-example-view",
			name: "Open example view",
			callback: () => this.activateView(),
		});
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE)[0];

		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_EXAMPLE, active: true });
		}

		workspace.revealLeaf(leaf);
	}
}
```

## Important rules

- **Never store references to your views** in the plugin. Obsidian may call the
  view factory multiple times, and views can be recreated.
- Avoid side effects in the view constructor; do work in `onOpen()`.
- To find existing view instances, use `workspace.getLeavesOfType(type)` and
  inspect `leaf.view`:

```ts
this.app.workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE).forEach((leaf) => {
	if (leaf.view instanceof ExampleView) {
		// ...
	}
});
```

- `workspace.revealLeaf(leaf)` expands a leaf if it's collapsed in a sidebar.
