# Repository metadata seeding

Built-in plugin and color-scheme metadata is bundled as a committed snapshot in `src/metadata/repository-metadata.snapshot.json`.

## What is seeded

- `Author` — currently sourced from the repository owner login and marked with `authorSource: "repo-owner"`
- `Stars` — GitHub `stargazers_count`
- `Created` — GitHub repository `created_at`
- `Updated` — GitHub repository `pushed_at`
- provenance/supporting fields such as `owner`, `repoSlug`, `homepage`, `license`, `topics`, and `fetchedAt`

## What is intentionally omitted

- download/install counts
- weekly trend / download trend

Those fields are hidden until a reliable generic public provider exists.

## Refresh workflow

Normal app users do **not** fetch metadata at runtime.

Maintainers refresh the bundled snapshot with:

```bash
bun run metadata:refresh
```

Optional:

- `GITHUB_TOKEN=... bun run metadata:refresh`
- `bun run metadata:refresh --dry-run`
- `bun run metadata:refresh --allow-partial`

The refresh script reads repository refs from:

- built-in plugin schemas in `src/schemas/*.json`
- bundled color schemes in `src/colorschemes/catalog.json`

It normalizes refs by GitHub `owner/repo`, fetches repository data directly from the GitHub REST API, records `generatedAt` plus per-entry `fetchedAt`, sorts entries by `repoSlug`, and fails release-ready mode if bundled refs are missing from the output snapshot.

## Refresh mode semantics

- `bun run metadata:refresh` is the release-ready path. It writes `src/metadata/repository-metadata.snapshot.json` only when fetches and coverage are complete.
- `GITHUB_TOKEN=... bun run metadata:refresh` uses the same direct GitHub REST flow with an optional bearer token for rate-limit headroom.
- `bun run metadata:refresh --dry-run` performs the same fetch/build/diff flow as a normal refresh, prints the diff summary, and does **not** write the runtime snapshot.
- `bun run metadata:refresh --allow-partial` is exploratory only. It reports diffs, fetch errors, and missing repositories, and does **not** write the runtime snapshot.
- `bun run metadata:refresh --dry-run --allow-partial` is also exploratory only. It fetches what it can, prints warnings, and does **not** write the runtime snapshot.

If GitHub rate limits an unauthenticated refresh, retry with `GITHUB_TOKEN=... bun run metadata:refresh`. Partial mode is not a release-ready workaround.

## Source policy

- Built-in plugins and built-in color schemes use the bundled snapshot for app-maintained metadata.
- Built-in UI does not fall back to stale schema/catalog `author`, `stars`, or date fields.
- External/global/project schemas may still carry `author` and `stars` as optional schema-authored fallback data when no bundled snapshot entry exists.
- `Author` is a product-facing field. In the current dataset it is repo-owner-derived, with provenance preserved by `authorSource` and `owner`.
