# Settings

Plugins persist configuration as JSON in `data.json`, stored in the plugin's
folder. The `Plugin` class provides `loadData()` and `saveData()` for this, and
you build a UI with a `PluginSettingTab`.

## Loading and saving

Define a settings interface and defaults, then load them in `onload`:

```ts
interface MyPluginSettings {
	greeting: string;
	enabled: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	greeting: "Hello",
	enabled: true,
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MySettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
```

`Object.assign` with defaults first ensures missing keys get sensible values the
first time the plugin is enabled.

## The settings tab

`PluginSettingTab` gives you a `containerEl` to render into, and a `display()`
method you override to build the UI. Each setting is built with the `Setting`
helper:

```ts
import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";

class MySettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Greeting")
			.setDesc("The message shown to the user")
			.addText((text) =>
				text
					.setPlaceholder("Hello")
					.setValue(this.plugin.settings.greeting)
					.onChange(async (value) => {
						this.plugin.settings.greeting = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enabled")
			.setDesc("Whether the plugin is active")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
```

`Setting` supports many controls: `.addText()`, `.addTextArea()`,
`.addToggle()`, `.addDropdown()`, `.addSlider()`, `.addButton()`,
`.addColorPicker()`, `.addMomentFormat()`, and more.

### Declarative settings API (Obsidian 1.13.0+)

Newer Obsidian supports a declarative `getSettingDefinitions()` that reads and
writes `this.plugin.settings` automatically, removing the `onChange` plumbing:

```ts
class MySettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions() {
		return [
			{
				name: "Greeting",
				control: {
					type: "text",
					key: "greeting",
					placeholder: "Hello",
				},
			},
			{
				name: "Enabled",
				control: {
					type: "toggle",
					key: "enabled",
				},
			},
		];
	}
}
```

Each control's `key` names a property on `this.plugin.settings`; Obsidian reads
the value, writes changes back, and calls `saveData()` automatically. If your
settings aren't stored on `this.plugin.settings`, override `getControlValue` and
`setControlValue`.

## External settings changes

If `data.json` is modified on disk by an external program (or a sync service),
implement `onExternalSettingsChange()` to reload:

```ts
onExternalSettingsChange() {
	this.loadSettings();
}
```
