# Releasing

Releasing a plugin has two phases: building the release artifacts, and (for
community distribution) publishing them and submitting the plugin.

## Building

```sh
npm run build
```

This type-checks (`tsc -noEmit`) and produces a production bundle in `main.js`.
The files that ship to users are:

- `main.js`
- `manifest.json`
- `styles.css` (optional)

## Versioning

1. Update `version` in `manifest.json` (and `package.json`), following
   [SemVer](https://semver.org/).
2. If the new version requires a newer Obsidian, update `minAppVersion`.
3. Add an entry to `versions.json` mapping the new plugin version to the minimum
   Obsidian version it requires, so older Obsidian installs fall back to a
   compatible version:

```json
{
	"1.0.0": "0.15.0",
	"1.1.0": "1.0.0"
}
```

## Publishing to the community directory

### 1. Create a GitHub release

1. Commit and push your changes.
2. Create a new release.
3. Set **Tag version** to the exact version from `manifest.json` (e.g. `1.0.0` —
   **no** `v` prefix).
4. Upload `main.js`, `manifest.json`, and `styles.css` (if present) as binary
   attachments.

Obsidian looks for the release whose tag matches `version` in `manifest.json`.
`main.js`, `manifest.json`, and `styles.css` are downloaded directly from the
release assets.

### 2. Submit for review (first release only)

1. Fork [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases).
2. Add an entry to `community-plugins.json`:

```json
{
	"id": "my-awesome-plugin",
	"name": "My Awesome Plugin",
	"author": "Your Name",
	"description": "Does something awesome in your vault.",
	"repo": "your-username/my-awesome-plugin",
	"branch": "main"
}
```

3. Open a pull request using the provided template.

`id`, `name`, `author`, and `description` must match `manifest.json`. `repo` is
the GitHub path (owner/repo); `branch` defaults to `master` if omitted.

### 3. How Obsidian pulls plugins

- Obsidian reads `community-plugins.json` for the list of available plugins.
- `name`, `author`, and `description` are used for search.
- The repo's `manifest.json` is used only to determine the latest version.
- The actual `main.js` / `manifest.json` / `styles.css` come from the GitHub
  release matching that version.
- If the running app is too old, `versions.json` selects an older compatible
  version.

### 4. Updating after publication

You only submit once. After that, publish a new GitHub release (Step 1) and
users update from within Obsidian.

## Automating with GitHub Actions

You can automate the build-and-release step with a workflow that triggers on a
version tag, builds with `npm run build`, and uploads the three files. See the
[sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin) and
community release workflows for reference implementations.

## Useful references

- [Submit your plugin (official)](https://docs.obsidian.md/plugins/releasing/submit-plugin)
- [Developer policies](https://docs.obsidian.md/Plugins/Releasing/Developer+policies)
- [Submission requirements](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins)
- [obsidian-releases repo](https://github.com/obsidianmd/obsidian-releases)
