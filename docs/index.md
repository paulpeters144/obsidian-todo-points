# Obsidian Plugin Development Docs

Reference material for building Obsidian plugins. These docs cover both the
general concepts that apply to any plugin and the specifics of this repository.

## Contents

- [Overview](overview.md) — how Obsidian plugins work, the runtime model, and the pieces that make up a plugin.
- [Project structure](project-structure.md) — the files every plugin needs and what each one does.
- [Manifest](manifest.md) — the `manifest.json` fields and what they control.
- [Plugin lifecycle](plugin-lifecycle.md) — `onload`, `onunload`, and resource cleanup.
- [Core API](core-api.md) — ribbon icons, commands, status bar, events, and the `App`/`Vault`/`Workspace` interfaces.
- [Settings](settings.md) — persisting configuration and building a settings tab.
- [Views](views.md) — registering custom views and panes.
- [Releasing](releasing.md) — versioning, building, and publishing to the community directory.

## External resources

- [Official Obsidian developer docs](https://docs.obsidian.md/)
- [Obsidian sample plugin template](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Unofficial Obsidian Plugin Developer Docs](https://marcus.se.net/obsidian-plugin-docs)
- [Obsidian API `obsidian.d.ts`](https://github.com/obsidianmd/obsidian-api)
