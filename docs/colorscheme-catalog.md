# Color Scheme Catalog

The bundled preview catalog lives in `src/colorschemes/catalog.json`. Each entry is a `ColorSchemeCatalogEntry` used by the Color Schemes page for previews and by the Lua generator for the active theme command.

## Repository identity and installation

- Every variant in a family shares the same `pluginRepo`.
- `getThemePluginSchemaId(pluginRepo)` resolves the underlying plugin schema ID (built-in alias or `theme--<repo-name>`).
- Installing any variant installs the plugin once and stores the selected catalog ID in `variantPreferences[pluginSchemaId]`.
- `activeScheme` stores the catalog entry ID; generation looks up that entry's `vimColorscheme` and optional `activation` metadata.

## Stable catalog IDs

Some persisted IDs are stable aliases and must not be renamed without an approved migration:

| Stable ID | Meaning |
|-----------|---------|
| `kanagawa` | Kanagawa Wave (`vimColorscheme: kanagawa-wave`) |
| `rose-pine` | Rosé Pine Main |
| `sonokai` | Sonokai default style |

Do not introduce duplicate replacement IDs such as `kanagawa-wave`, `rose-pine-main`, or `sonokai-default`.

## Adding a preview

1. Choose a globally unique kebab-case `id` that will remain stable across releases.
2. Set `pluginRepo` to the canonical repository URL used by the matching built-in schema.
3. Set `vimColorscheme` to the upstream-documented colorscheme command.
4. Populate `colors` from the theme's palette source (background, foreground, tokens, and UI chrome). Do not clone another variant's palette.
5. Add searchable `tags` and an accurate `variant` (`dark`, `light`, or `both`).
6. Add catalog invariant coverage in `src/colorschemes/catalog.test.ts`.

## Activation metadata

Some variants share one colorscheme command and require configuration before `vim.cmd.colorscheme`:

```json
{
  "activation": {
    "background": "dark",
    "globals": [{ "name": "sonokai_style", "value": "atlantis" }]
  }
}
```

### Supported fields

- `activation.background`: emits `vim.o.background = "dark"` or `"light"` before the colorscheme call.
- `activation.globals`: ordered primitive assignments via `vim.g["name"] = <literal>`.
  - Allowed value types: `string`, `number`, `boolean`.
  - Strings and global names are escaped; no raw Lua interpolation.

### Statement order in generated Lua

1. `vim.o.background` when present
2. `vim.g[...]` globals in catalog order
3. Protected `pcall(vim.cmd.colorscheme, ...)`

Entries without `activation` must preserve the previous generator output shape.

## Schema data vs core branches

- Variant behavior belongs in schema JSON and catalog data.
- **Do not** add runtime or generator branches keyed by `schema.id`, repository URL, or theme name.
- If a plugin needs behavior the generic activation contract cannot express, add a reviewed generic schema/catalog capability and document it here for all consumers.

## Required tests

- `src/colorschemes/catalog.test.ts` — data invariants, repository coverage, variant matrix, stable aliases
- `src/features/lua-generator/sections/__tests__/colorscheme-section.test.ts` — activation emission and escaping
- `src/features/colorschemes/storage.test.ts` — install/switch behavior and schema-shadowing guard
