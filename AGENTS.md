# AGENTS.md

Guidance for AI agents and contributors working on this Obsidian plugin.

## What this is

An Obsidian community plugin written in TypeScript. It extends Obsidian's
`Plugin` base class from the `obsidian` package. The source of truth is
`main.ts`; everything else is build config or metadata.

This plugin tracks todos that the user completes over time and shows a running
points total. Data is persisted with `loadData()`/`saveData()`.

## Project layout

- `main.ts` — plugin entry point. Exports a default class extending `Plugin`.
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
  `addSettingTab`, `registerView`, `registerEvent`, etc.) so Obsidian cleans it
  up automatically on unload.
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
