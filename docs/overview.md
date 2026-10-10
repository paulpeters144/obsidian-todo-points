# How Obsidian Plugins Work

Obsidian is a closed-source application, but it exposes a JavaScript/TypeScript
plugin API that runs inside the app. A plugin is a small bundle of JavaScript
that Obsidian loads and gives access to its internals through a well-defined
interface.

## The runtime model

When a plugin is enabled, Obsidian:

1. Reads the plugin's `manifest.json` for metadata (id, version, minimum app
   version, etc.).
2. Loads the bundled `main.js`.
3. Calls `require("obsidian")`-style imports from the host app, so your code
   talks to the real Obsidian objects — not a copy.
4. Instantiates the default class exported by `main.js`, which must extend the
   `Plugin` base class.
5. Calls the plugin's `onload()` method to let it register its functionality.

Your code never controls the whole app. It registers *things* — ribbon icons,
commands, views, event handlers, settings tabs — through the `Plugin` instance,
and Obsidian owns their lifecycle.

## The key idea: registration, not construction

Almost everything in Obsidian's plugin API follows the same pattern: you call a
method on `this` (your plugin instance) to register a resource, and Obsidian
cleans it up automatically when the plugin unloads.

```ts
export default class MyPlugin extends Plugin {
	onload() {
		this.addRibbonIcon("dice", "Hello", () => {
			new Notice("Hello, world!");
		});

		this.addCommand({
			id: "greet",
			name: "Greet",
			callback: () => new Notice("Hello!"),
		});

		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				console.log("Opened", file?.path);
			})
		);
	}
}
```

Because each of these is registered through the plugin, Obsidian removes them
all when the plugin is disabled. You rarely need to write cleanup code yourself —
and forgetting to register (e.g. calling `setInterval` directly instead of
`this.registerInterval(...)`) is the most common source of leaks and bugs.

## The `App` object

Every plugin has `this.app`, an `App` instance that is the root of the Obsidian
API. From it you can reach:

- `app.vault` — read, write, create, and delete files and folders.
- `app.workspace` — the panes/leaves on screen; open files, reveal leaves, listen
  to events.
- `app.metadataCache` — cached parsed metadata (headings, links, tags, blocks)
  for every markdown file.
- `app.commands` — execute commands.

You will use `this.app.vault` and `this.app.workspace` for most tasks.

## What a plugin looks like on disk

A minimal plugin is a folder inside `.obsidian/plugins/` containing:

- `manifest.json` — metadata Obsidian reads to identify and version the plugin.
- `main.js` — the bundled entry point (a single file, no external imports except
  the host app's built-ins).
- `styles.css` — optional stylesheet, loaded automatically if present.

During development you also keep the TypeScript source (`main.ts`), a
`package.json`, and build tooling, but only `manifest.json`, `main.js`, and
`styles.css` ship to users.
