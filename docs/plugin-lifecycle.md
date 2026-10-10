# Plugin Lifecycle

Every plugin extends the `Plugin` base class. Obsidian creates one instance of
your class and drives it through a lifecycle.

## `onload()`

Called when the plugin is loaded/enabled. This is where you register everything
your plugin does: ribbon icons, commands, settings tabs, views, event handlers,
and so on.

```ts
import { Plugin } from "obsidian";

export default class MyPlugin extends Plugin {
	async onload() {
		this.addRibbonIcon("dice", "Greet", () => {
			new Notice("Hello!");
		});
	}
}
```

`onload` can be `async`, so you can `await` things like `this.loadData()`.

## `onunload()`

Called when the plugin is disabled or unloaded. In most cases you do **not** need
to override it, because everything registered through the `Plugin` methods is
removed automatically. You only need `onunload()` for resources that Obsidian
doesn't know about — for example, manually created DOM elements.

```ts
onload() {
	this.statusBarElement = this.addStatusBarItem().createEl("span");
}

onunload() {
	// addStatusBarItem() already cleans up its element on unload;
	// this manual remove() is only needed for elements we created ourselves.
	this.statusBarElement.remove();
}
```

## The `Plugin` instance properties

- `this.app` — the global `App` object (the root of the API).
- `this.manifest` — the parsed `manifest.json` contents.

## Registration methods that auto-cleanup

These are the reason you rarely need `onunload`:

| Method | What it registers |
| --- | --- |
| `addRibbonIcon(icon, title, callback)` | A ribbon icon in the left sidebar. |
| `addStatusBarItem()` | An element in the bottom status bar. |
| `addCommand(command)` | A command in the command palette. |
| `addSettingTab(tab)` | A settings tab. |
| `registerView(type, factory)` | A custom view type. |
| `registerEvent(eventRef)` | An Obsidian event subscription. |
| `registerDomEvent(el, type, callback)` | A DOM event listener. |
| `registerInterval(id)` | A `setInterval` that gets cleared on unload. |
| `registerMarkdownPostProcessor(fn, sortOrder)` | A reading-mode renderer. |
| `registerMarkdownCodeBlockProcessor(lang, handler)` | A code-block renderer. |
| `registerEditorExtension(ext)` | A CodeMirror 6 extension. |
| `registerObsidianProtocolHandler(action, handler)` | An `obsidian://` URL handler. |
| `addChild(component)` | A child `Component` loaded/unloaded with the plugin. |

## Rules of thumb

1. Always register via the plugin so cleanup is automatic.
2. Use `this.registerInterval(...)` instead of bare `setInterval(...)`.
3. Use `this.registerEvent(...)` instead of bare `workspace.on(...)` / `vault.on(...)`.
4. Use `this.registerDomEvent(...)` for events on `window` or `document`.
5. Only override `onunload()` for things that can't be registered (rare).

Failing to register intervals and event listeners is the most common cause of
leaks, duplicate handlers, and errors after a plugin reloads.
