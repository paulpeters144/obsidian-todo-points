# Manifest

`manifest.json` describes your plugin to Obsidian. Obsidian reads it when
enabling the plugin and when installing from the community directory.

```json
{
	"id": "my-awesome-plugin",
	"name": "My Awesome Plugin",
	"version": "1.0.0",
	"minAppVersion": "0.15.0",
	"description": "Does something awesome in your vault.",
	"author": "Your Name",
	"authorUrl": "https://github.com/your-username",
	"fundingUrl": "https://example.com/donate",
	"isDesktopOnly": false
}
```

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `id` | Yes | Unique identifier. Used as the plugin folder name. Cannot contain `obsidian`, and must be unique across all published plugins. |
| `name` | Yes | Human-friendly display name. |
| `version` | Yes | Plugin version, in `x.y.z` [SemVer](https://semver.org/) format. |
| `minAppVersion` | Yes | The minimum Obsidian version the plugin requires. |
| `description` | Yes | A description of what the plugin does. |
| `author` | Yes | The author's name. |
| `authorUrl` | No | A URL to the author's website. |
| `fundingUrl` | No | A link where users can support development. |
| `isDesktopOnly` | No | Set `true` if the plugin uses Node.js or Electron APIs (and thus can't run on mobile). |

## Notes

- **`id` must match the folder name.** If your plugin lives in
  `.obsidian/plugins/my-awesome-plugin/`, the `id` must be `my-awesome-plugin`.
- **Manifest changes require a full restart** of Obsidian — a "Reload app without
  saving" is not enough.
- For community submissions, the `id`, `name`, and `description` must match the
  entry you add to `community-plugins.json` in the
  [`obsidian-releases`](https://github.com/obsidianmd/obsidian-releases) repo.
- The `description` should be accurate and consistent across `manifest.json`,
  your README, and your submission — the review bot checks for mismatches.

See the official [Manifest reference](https://docs.obsidian.md/Reference/Manifest)
for the complete schema.
