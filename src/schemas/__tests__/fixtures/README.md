# formatter-nvim upstream snapshot fixture

This fixture pins upstream `formatter.nvim` filetype module exports so our curated catalog
in `src/schemas/formatter-nvim.json` cannot silently drift.

- Source: `https://github.com/mhartington/formatter.nvim`
- Snapshot file: `formatter-nvim-upstream.json`
- Recorded ref: in the fixture `ref` field

## When to refresh

Refresh only when:

1. bumping `src/schemas/formatter-nvim.json` `version`, or
2. intentionally adopting upstream formatter changes.

## How to refresh

```bash
bun run scripts/refresh-formatter-nvim-snapshot.ts
```

- Network is required only for this refresh script.
- Tests never hit the network; they use the vendored JSON snapshot.
- The refresh script lives at `scripts/refresh-formatter-nvim-snapshot.ts` and writes
  back to this directory.
