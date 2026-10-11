# Todo Points

Track your to-do progress over time. Tag checklist items with `#pN` points and
project tags, then view a color-coded chart of points completed by day, week,
or month.

Todo Points is a read-only dashboard. It scans every markdown file in your
vault for checkbox lists and shows a canvas bar chart of points completed over
time. It never edits your notes — you manage tasks with Obsidian's native
checkboxes.

## Features

- **Points via `#pN` tags** — put a `#pN` tag anywhere in a task line to assign
  points. `- [ ] Fix bug #p5` is worth 5 points (any non-negative integer works).
- **Project tags** — any other `#tag` on the task line (e.g. `#house`, `#game`)
  names a project. A task's points count toward each of its project tags, and
  tasks without one fall into `other`.
- **Stacked bar chart** — bars are stacked by project (colors derived from the
  project name), with a legend of per-project totals for the visible period.
  Click a legend item to filter to that project; click it again (or `all`) to
  restore the stacked view.
- **Periods** — view points completed by day (last 7), week (last 8), or month
  (last 6).
- **Editor highlighting** — `#pN` tags are highlighted in a soft green in both
  the editor and reading view.

## Usage

1. Write checkbox lists. A date (year, month, and day) on a line above a group
   of tasks sets their completion day:

   ```markdown
   # 2026-10-10

   - [x] Fix bug #p5 #work
   - [ ] Write docs #p2 #work
   - [ ] Mow the lawn #p3 #house
   ```

2. Open the Todo Points view (ribbon icon or command) to see your chart.

A completed task is a `[x]` checkbox. The completion day is resolved from, in
order: a date header on a line above the task, or a date in the file name (such
as `2026-10-10.md` or `20261010.md`). Supported formats include `2026-10-10`,
`10/10/2026`, `10-10-2026`, `10.10.2026`, `October 10, 2026`, and
`10 October 2026` (with optional ordinals). Tasks with no discoverable date are
excluded from the time charts.

## Installation

### From the community plugins directory

1. Open **Settings → Community plugins → Browse**.
2. Search for "Todo Points" and install it.
3. Enable it.

### Manually

Copy `main.js`, `manifest.json`, and `styles.css` into
`<vault>/.obsidian/plugins/todo-points/`, then enable the plugin from
**Settings → Community plugins**.

## Building

```sh
pnpm install
pnpm run dev    # watch mode
pnpm run build  # type-check + production bundle
```
