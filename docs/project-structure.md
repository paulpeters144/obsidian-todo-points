# Project Structure

A plugin project has two kinds of files: the ones that **ship** to users and
the ones that only exist for **development**.

## Files that ship

These are the only files Obsidian actually downloads and runs:

| File | Purpose |
| --- | --- |
| `manifest.json` | Plugin metadata: id, name, version, minimum app version, description, author. |
| `main.js` | The bundled plugin code. A single CommonJS file with no external dependencies (except Obsidian's built-ins). |
| `styles.css` | Optional stylesheet, loaded automatically if present. |

## Development-only files

| File | Purpose |
| --- | --- |
| `main.ts` | The source of truth. Exports a default class extending `Plugin`. |
| `package.json` | Dependencies and scripts (`dev`, `build`, etc.). |
| `esbuild.config.mjs` | Bundles `main.ts` into `main.js`. |
| `tsconfig.json` | TypeScript configuration. |
| `versions.json` | Maps plugin versions to the minimum Obsidian version they require (for old app compatibility). |
| `.editorconfig`, `.eslintrc` | Code style / lint configuration. |

## The build pipeline

The build is powered by [esbuild](https://esbuild.github.io/). `main.ts` is the
entry point; esbuild bundles it (and any modules it imports) into a single
`main.js`.

Crucially, the `external` list in `esbuild.config.mjs` tells esbuild **not** to
bundle `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, and Node builtins.
These are provided by the host app at runtime, so bundling them would break
things. The generated `main.js` uses `require("obsidian")` internally.

```mjs
external: [
	"obsidian",
	"electron",
	"@codemirror/autocomplete",
	// ... etc
	...builtins,
],
```

## The two scripts

- `npm run dev` — watch mode. Rebuilds `main.js` whenever `main.ts` changes.
- `npm run build` — type-checks with `tsc -noEmit` then produces a minified,
  tree-shaken production bundle.

Because `main.js` is generated, never edit it by hand — edit `main.ts` and
rebuild.

## The `versions.json` file

`versions.json` maps plugin versions to the minimum Obsidian version they need:

```json
{
	"1.0.0": "0.15.0",
	"1.1.0": "1.0.0"
}
```

If a user runs an older Obsidian that can't satisfy `minAppVersion` in
`manifest.json`, Obsidian consults `versions.json` to find the newest plugin
version that *is* compatible, and downloads that instead. You update it as part
of every release.
