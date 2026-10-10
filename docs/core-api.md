# Core API

This doc covers the most commonly used pieces of the Obsidian API: ribbon icons,
commands, the status bar, events, and the root `App`/`Vault`/`Workspace`
interfaces.

## Ribbon icons

Add an icon to the left ribbon:

```ts
this.addRibbonIcon("dice", "Print to console", () => {
	console.log("Hello, you!");
});
```

- First argument is an [icon name](https://docs.obsidian.md/Plugins/User+interface/Icons)
  (Lucide icons are supported).
- Second is the tooltip.
- Third is the click callback.
- Returns the created `HTMLElement`.

Users can remove ribbon icons, so also expose important functionality as a
**command**.

## Commands

Register a command that appears in the command palette:

```ts
this.addCommand({
	id: "open-my-view",
	name: "Open my view",
	callback: () => this.activateView(),
	// hotkeys: [{ modifiers: ["Mod", "Shift"], key: "m" }],
	// checkCallback: (checking) => { ... },
});
```

- The `id` and `name` are automatically prefixed with the plugin id/name, so a
  command id `open-my-view` becomes `my-plugin:open-my-view` in practice.
- `hotkeys` optionally assigns a default hotkey.
- `checkCallback` lets you enable/disable the command dynamically based on
  context.

## Status bar

Add an element to the bottom status bar:

```ts
const item = this.addStatusBarItem();
const span = item.createEl("span", { text: "Hello" });
```

`addStatusBarItem()` is not available on mobile.

## Events

Obsidian objects (`App`, `Workspace`, `Vault`, `MetadataCache`) are event
emitters. Subscribe with `.on(...)` and wrap the result in `registerEvent` so it
is cleaned up:

```ts
this.registerEvent(
	this.app.workspace.on("editor-change", (editor) => {
		// fired when the active editor's content changes
	})
);

this.registerEvent(
	this.app.workspace.on("active-leaf-change", () => {
		// fired when the active pane changes
	})
);

this.registerEvent(
	this.app.vault.on("modify", (file) => {
		// fired when a file is modified
	})
);
```

Common workspace events include `file-open`, `editor-change`,
`active-leaf-change`, `layout-change`, and `quick-preview`. Common vault events
include `create`, `modify`, `delete`, and `rename`.

### DOM events

For listeners on `window` or `document`, use `registerDomEvent`:

```ts
this.registerDomEvent(window, "resize", () => {
	console.log("Window resized");
});
```

### Intervals

Use `registerInterval` so the interval is cleared on unload:

```ts
this.registerInterval(window.setInterval(() => console.log("tick"), 1000));
```

## The `App`, `Vault`, and `Workspace` interfaces

### `this.app.vault`

Interact with files and folders:

```ts
const file = this.app.vault.getAbstractFileByPath("folder/note.md");
const content = await this.app.vault.read(file as TFile);
await this.app.vault.modify(file as TFile, "new content");
await this.app.vault.create("new-note.md", "hello");
await this.app.vault.delete(file);
const files = this.app.vault.getMarkdownFiles();
```

### `this.app.workspace`

Interact with panes and the active file:

```ts
const activeFile = this.app.workspace.getActiveFile();
const leaves = this.app.workspace.getLeavesOfType("markdown");
this.app.workspace.revealLeaf(leaf); // expand a collapsed sidebar leaf
```

### `this.app.metadataCache`

Access cached, parsed markdown metadata:

```ts
const cache = this.app.metadataCache.getFileCache(file);
// cache.headings, cache.links, cache.tags, cache.embeds, ...
```

## User notifications

Use `Notice` to show a transient message:

```ts
import { Notice } from "obsidian";

new Notice("Hello, world!");
```

## Modals

Use `Modal` for a dialog box:

```ts
import { Modal } from "obsidian";

class MyModal extends Modal {
	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Hello!");
	}
}

new MyModal(this.app).open();
```

## The full API

The complete typed API lives in `obsidian.d.ts` (installed as the `obsidian`
npm package). The browser reference is at
<https://docs.obsidian.md/Reference/TypeScript+API/Plugin>.
