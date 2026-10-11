# AGENTS.md

Guidance for AI agents and contributors working on this Obsidian plugin.

## What this is

An Obsidian community plugin written in TypeScript. It extends Obsidian's
`Plugin` base class from the `obsidian` package. The code is split into
layers (client view → adapter → manager → access); see Project layout below.

This plugin is a read-only dashboard. It scans every markdown file in the
vault for checkbox lists and shows a canvas bar chart of points completed by
day (last 7), week (last 8), or month (last 6). Points come from a `#pN` tag
anywhere in the task line (e.g. `- [ ] Fix bug #p5` is worth 5 points; any
non-negative integer is allowed). These `#pN` tags are highlighted in a soft
green both in the editor (via a CodeMirror `ViewPlugin` + `MatchDecorator`)
and in reading view (via a Markdown post processor), styled by the
`.todo-points-tag` class in `styles.css`. Any other `#tag` on the task line
(e.g. `#house`, `#game`) names a project: a task's points count toward each of
its project tags, and tasks without one fall into `other`. Each chart bar is
stacked by project (colors are derived from the project name) with a legend of
per-project totals for the visible period; clicking a legend item filters the
chart to that project, and clicking it again (or `all`) restores the stacked
view. A completed task is a `[x]` checkbox. The completion day comes, in
priority order, from: a date header (containing a year, month, and day) on a
line above the task, or a date parsed from the file name (e.g.
`2026-10-10.md` or `20261010.md`); supported formats include `2026-10-10`,
`10/10/2026`, `10-10-2026`, `10.10.2026`, `October 10, 2026`, and
`10 October 2026` (with optional ordinals). Tasks with no discoverable date are
excluded from the time charts. The plugin never edits markdown: users manage
tasks with Obsidian's native checkboxes. Nothing is persisted; the files
themselves are the source of truth.

## Project layout

The code is organized in layers; each layer only talks to the layer directly
below it:

- `src/client.view.ts` — the client layer. The `ItemView` (stats cards, period
  toggle, canvas chart, legend filter). Holds only UI state (period, selected
  project, last rendered data) and communicates with the rest of the plugin
  exclusively through messages: it sends `ClientMessage`s (e.g. `query` with a
  period) and receives `ClientUpdate`s (`render` with stats + chart data, or
  `refresh` meaning "re-send your query"). Also owns presentation-only helpers
  like `projectColor`.
- `main.ts` — the adapter layer and plugin entry point (default export
  extends `Plugin`). Translates `ClientMessage`s from views into
  `AppRequest`s for the manager (`toAppRequest`), translates `AppResponse`s
  back into `ClientUpdate`s (`toClientUpdate`), and pushes manager events to
  all open views (`appEventToClientUpdate` + `broadcast`). Owns all Obsidian
  wiring: view registration, ribbon icon, command, the `#pN`-tag CodeMirror
  highlighter, and the reading-view post processor.
- `src/manager.app.ts` — the single manager (`AppManager`). All business logic:
  caches the parsed tasks, computes stats and the project-stacked chart data,
  and handles a message protocol (`AppRequest`: `init`, `getChart`;
  `AppResponse`; `AppEvent`: `dataChanged` pushed when the vault changes).
  Contains no Obsidian UI code.
- `src/access.vault.ts` — access layer: reads markdown files from the whole
  vault and registers vault change callbacks.
- `src/access.tasks.ts` — access layer: parses raw file snapshots into `TaskItem`
  objects (checkbox match, `#pN` points, project tags, date headers, file-name
  dates) and holds the shared time helpers (`DAY_MS`,
  `startOfDay/Week/Month`, `sumPointsBetween`).
- `styles.css` — view styles, loaded automatically by Obsidian.
- `main.js` — generated bundle (do not edit; produced by esbuild).
- `manifest.json` — plugin metadata (id, name, version, minAppVersion, ...).
- `versions.json` — maps plugin versions to minimum Obsidian versions.
- `package.json` — dependencies and scripts.
- `esbuild.config.mjs` — build config. Bundles `main.ts` into `main.js`.
- `tsconfig.json` — TypeScript config.
- `docs/` — developer documentation on writing Obsidian plugins.

## Commands

```sh
pnpm install       # install dependencies
pnpm run dev       # watch mode: rebuild main.js on every change
pnpm run build     # type-check (tsc --noEmit) + production bundle
```

Use pnpm (not npm). There is no test suite and no `lint` script. Before
finishing work, run `pnpm run build` to make sure the project type-checks and
bundles cleanly.

## Conventions

- Code uses tabs for indentation and double quotes for strings (see `.editorconfig`
  and `tsconfig.json`).
- Keep the plugin class as the default export of `main.ts`.
- Import from the `obsidian` package only — never `require('obsidian')` in
  source; the bundler marks `obsidian`, `electron`, and Node builtins as external.
- Register everything through the plugin instance (`addRibbonIcon`, `addCommand`,
  `registerView`, `registerEvent`, etc.) so Obsidian cleans it up automatically
  on unload.
- Do not add code comments unless asked.

## Development workflow

1. Run `pnpm run dev`.
2. In Obsidian, run **Reload app without saving** (or `Ctrl+P`) to pick up changes.
3. Enable the plugin under **Settings → Community plugins**.
4. Use the developer console (`Ctrl+Shift+I`) to inspect logs and errors.

Manifest changes require a full restart of Obsidian (not just a reload).

## Documentation

Reference material for building Obsidian plugins lives in [`docs/`](docs/).
Start with `docs/index.md`.
