---
description: Commit any pending changes, then bump the version, rebuild, tag, push, and create a GitHub release so the update goes live in Obsidian's community plugins.
---

Release this Obsidian plugin. Run the following steps exactly, in order, and stop at the first failure (report the error and do not continue).

1. Run `git status --short` to check for uncommitted work. If there are any changes (modified, deleted, or new source files), stage and commit them now:
   - Stage with `git add -A` (this already respects `.gitignore`, so `main.js`, `data.json`, and `node_modules` are never committed).
   - Commit with a concise imperative message matching the repo's existing style (e.g. `fix: ...` or `feat: ...`).
   - If the working tree is already clean, skip this step.

2. Run `pnpm run release $ARGUMENTS`. `$ARGUMENTS` may be `major` or `minor`; if empty it defaults to `patch`. This runs `scripts/release.js`, which:
   - bumps `version` in `manifest.json` and `package.json`,
   - adds the new version to `versions.json`,
   - rebuilds `main.js` via `pnpm run build`,
   - commits the bump, tags it, pushes the branch and tag to `origin`,
   - creates and publishes a non-draft GitHub release (tag = version) with `main.js`, `manifest.json`, and `styles.css`.

3. Confirm the release exists with `gh release view <new-version>` and report the new version and the release URL. No manual steps are needed afterward: Obsidian reads the bumped `manifest.json` from the repo's default branch and serves the matching GitHub release to users.
