# Sections

> Top-level section generators that produce config-driven Lua code.
> Located in `src/features/lua-generator/sections/`.

## Overview

Sections generate Lua code from **project configuration data** (not from graphs). They handle plugins, Neovim options, keymaps, colorschemes, and other settings that don't require graph traversal.

Sections are generated in Phase 5 of the pipeline, before graph generation (Phase 6).

## Section Order

Sections are assembled in a canonical order defined in `sections/types.ts`:

```typescript
export const SECTION_ORDER: readonly SectionId[] = [
  'leader-key',
  'neovim-options',
  'callable-functions',   // Special: graph-generated, not a section generator
  'plugins',
  'lsp',
  'colorscheme',
  'highlights',
  'project-keymaps',
] as const
```

**Why this order matters:**
1. **Leader key** must come first -- keymaps reference `<leader>`
2. **Neovim options** before plugins -- plugins may depend on options
3. **Callable functions** before plugins -- autocmds in plugins may call them
4. **Plugins** before LSP -- LSP depends on lspconfig/mason plugins
5. **Colorscheme** before highlights -- highlights may override colorscheme
6. **Project keymaps** last -- may reference callable functions

## Section Result Type

All section generators return:

```typescript
interface SectionResult {
  id: SectionId
  code: string[]                          // Array of Lua code lines
  diagnostics: SectionGenerationDiagnostic[]  // Section-level diagnostics
  skippedReasons?: string[]               // Why section was skipped (optional)
}
```

## Existing Sections

### 1. Leader Key (`leader-key-section.ts`)

**Input:** `{ leaderKey?: string }`

**Generates:**
```lua
vim.g.mapleader = " "
vim.g.maplocalleader = " "
```

**Behavior:**
- Skips if leader key is `\` (Neovim default)
- Sets both `mapleader` and `maplocalleader` to the same value
- Must be first section (before any keymap definitions)

### 2. Neovim Options (`neovim-options-section.ts`)

**Input:** `{ options: Record<string, NeovimOptionValue> }`

**Generates:**
```lua
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.shiftwidth = 2
vim.opt.tabstop = 2
```

**Behavior:**
- Only emits options that differ from Neovim defaults
- Groups options by category with comments
- Skips `mapleader` (handled by leader-key section)
- Uses `vim.opt` (not `vim.o`) for consistent list/map handling

### 3. Plugin Section (`plugin-section.ts`)

**Input:** `{ resolvedPlugins: ResolvedPluginForGeneration[], themePluginIds: Set<string> }`

**Generates:**
```lua
-- Plugin declarations (single table-form call)
vim.pack.add({
  { src = "https://github.com/nvim-treesitter/nvim-treesitter", version = "main" },
  { src = "https://github.com/nvim-telescope/telescope.nvim" },
})

-- Plugin configuration (default path)
require("telescope").setup({
  defaults = {
    layout_config = { width = 0.5 },
  },
})

-- Plugin configuration (setup.render lua-template path)
local config = {
  highlight = { enable = true },
}
local augroup = vim.api.nvim_create_augroup('VinelaNvimTreesitterHighlight', { clear = true })
vim.api.nvim_create_autocmd('FileType', {
  -- resolve filetype aliases with vim.treesitter.language.get_lang
  -- call vim.treesitter.start through pcall; missing parsers fail quietly
})
```

**Behavior:**
- Sorts enabled plugins alphabetically by `schema.pluginName` for deterministic output.
- Emits one `vim.pack.add({...})` declaration block, then emits per-plugin setup for non-theme plugins.
- Theme plugins are still declared in `vim.pack.add`, but setup calls are skipped here (handled by the colorscheme section).
- Merges schema defaults and user config via local `mergeSimplifiedConfig()` (not `mergePluginConfig()`).
- For `plugin-keymap` options, there is no static `default` field; `mergeSimplifiedConfig()` writes an `undefined` placeholder so each keymap option is guaranteed to enter the keymap normalization pass.
- Runs a plugin-keymap normalization pipeline **before** `unflattenDotKeys()`:
  1. `resolvePluginKeymapDefaults(rawValue, option)`
  2. `flattenPluginKeymapValue({ preset, overrides })`
  3. `transformKeymapCommands(...)`
- `_meta` editor metadata is UI-only and is never forwarded into Lua output.
- Applies generic schema generation rules before `emitKey` remapping:
  - conflict diagnostics
  - subtree omission/filter rules
  - include/default omission rules
  - value maps and path-string emission rules
  - mapping-table serialization
- Unflattens dot-notation keys only after generic schema interpretation is complete.
- When `setup.render.kind === "lua-template"`, emits trusted schema-authored Lua instead of `require().setup({...})`. Substitutes `{{config}}` with the merged serialized table and `{{requirePath}}` with a Lua string literal. Ordering is `preSetup` → rendered template → `postSetup`.
- Core code does **not** branch on plugin ids for setup generation. If a plugin needs new behavior, add a generic schema capability that global/project-local schemas can use too.

#### Plugin-keymap normalization details

For plugin-keymap options, the generator transforms stored JSON shape into Lua-serializable data in three steps:

1. **Default resolution (`resolvePluginKeymapDefaults`)**
   - Applies `defaultPreset` when stored `preset` is missing/invalid shape.
   - Resolves `overrides` into `Record<string, PluginKeymapCommandEntry[] | false>`.
   - Consumes `_meta` / legacy `rebindLinks` for UI link hydration/pruning only; this metadata does not participate in Lua table emission.

2. **Shape flattening (`flattenPluginKeymapValue`)**
   - Converts stored shape:
     `{ preset: "default", overrides: { "<CR>": ["accept", "fallback"], "<C-e>": false } }`
   - Into Lua-ready flat shape:
     `{ preset: "default", "<CR>": ["accept", "fallback"], "<C-e>": false }`

3. **Command transformation (`transformKeymapCommands`)**
   - Preserves string commands unchanged.
   - Converts `{ lua: "..." }` entries into `LuaRawCode` markers via `rawLua(...)` so serializer emits verbatim Lua.
   - Preserves `false` (disabled keys) and `preset`.
   - Drops malformed/empty entries and records warning diagnostics.

#### Raw Lua emission marker (`LuaRawCode`)

Raw Lua is emitted verbatim only when values are wrapped with `rawLua()`.

```typescript
const marker = rawLua('vim.snippet.jump(1)')
serializeValue(marker) // => vim.snippet.jump(1)
```

`LuaRawCode` is Symbol-branded, so it cannot be constructed from JSON data. Plain objects are serialized as normal Lua tables, not raw code.

### 4. LSP Section (`lsp-section.ts`)

**Input:** `{ enabledServers: string[], resolvedPlugins: ResolvedPluginForGeneration[] }`

**Generates:**
```lua
-- Mason auto-install (if mason-nvim plugin enabled)
local mr = require("mason-registry")
mr.refresh(function()
  for _, tool in ipairs({
    "lua-language-server",
    "typescript-language-server",
  }) do
    local ok, p = pcall(mr.get_package, tool)
    if ok and not p:is_installed() then
      p:install()
    end
  end
end)

-- LSP server enable (if nvim-lspconfig enabled)
if vim.fn.has("nvim-0.11") == 1 then
  vim.lsp.enable({
    "lua_ls",
    "ts_ls",
  })
else
  vim.notify("[vinela] LSP enable requires Neovim 0.11+", vim.log.levels.WARN)
end
```

**Behavior:**
- Checks installed plugin schemas for generic LSP capabilities (`lsp-package-installer`, `lsp-server-enabler`)
- Adds Neovim 0.11+ version guard for `vim.lsp.enable()`
- Skips entirely if no LSP servers are enabled
- Reports `skippedReasons` when plugins are missing

### 5. Colorscheme Section (`colorscheme-section.ts`)

**Input:** `{ activeScheme: string | null }`

**Generates:**
```lua
local ok, err = pcall(vim.cmd.colorscheme, "catppuccin")
if not ok then
  vim.notify("Colorscheme 'catppuccin' not found: " .. err, vim.log.levels.WARN)
end
```

**Behavior:**
- Wraps in `pcall` for graceful fallback if colorscheme not installed
- Looks up catalog entry for the vim colorscheme command name
- Skips if no active scheme selected

### 6. Highlight Section (`highlight-section.ts`)

**Input:** `{ highlightOverrides: HighlightOverride[] }`

**Generates:**
```lua
-- Helper function (emitted once)
local function set_hl_merged(group, attrs)
  local ok, existing = pcall(vim.api.nvim_get_hl, 0, { name = group, link = false })
  vim.api.nvim_set_hl(0, group, vim.tbl_extend("force", ok and existing or {}, attrs))
end

set_hl_merged("Normal", { fg = "#ffffff", bg = "#000000" })
set_hl_merged("Comment", { italic = true })
```

**Behavior:**
- Uses merge semantics (reads existing highlight before setting)
- Emits helper function only once, then calls it per override
- Validates color values (hex format, named colors)
- Skips empty override lists

### 7. Project Keymaps Section (`project-keymaps-section.ts`)

**Input:** `{ keymaps: ProjectKeymap[], profiles?: ProjectProfile[], profileOverrides?: Record<string, boolean>, resolvedPlugins: ResolvedPluginForGeneration[] }`

**Generates:**
```lua
vim.keymap.set("n", "<leader>f", "<cmd>Telescope find_files<CR>", { desc = "Find files" })
vim.keymap.set({"n", "v"}, "gd", function()
  vim.lsp.buf.definition()
end, { silent = true, desc = "Go to definition" })
```

**Behavior:**
- Supports 6 action types: `run-action`, `run-function`, `set-option`, `set-variable`, `code-block`, `run-custom-action`
- `run-custom-action` calls callable graphs via the global callable table using emitted callable keys: `_G._vinela_callables["<graph_name>_<shortid>"]({})`.
- Formats modes as string (single) or array (multiple)
- Builds options table with `desc`, `silent`, `expr`; emits `remap = true` only when `noremap` is false (since `vim.keymap.set` defaults to non-remap)
- Emits only effectively active manual keymaps: unprofiled or unknown-only assignments use `enabled`; defined profile assignments use `enabledOverride` when present, otherwise active-profile OR state. Graph `set-keymap` nodes and plugin-schema keymaps are unaffected.

**Command RHS normalization (`run-action` with `actionType='command'`):**

All command strings are canonicalized into `<cmd>...<CR>` form **before** Lua escaping. The rules applied (in order):

1. **Already prefixed with `<cmd>`** — preserve as-is; strip any redundant `:` immediately after `<cmd>` (e.g. `<cmd>:write<CR>` → `<cmd>write<CR>`).
2. **Bare or `:` prefixed command** — strip the leading `:` if present, then wrap in `<cmd>...<CR>`. If the value already contains `<CR>` anywhere (hybrid forms like `:cprev<CR>zz`), do **not** append another `<CR>`.

| User input | Generated RHS |
|---|---|
| `write` | `<cmd>write<CR>` |
| `:write` | `<cmd>write<CR>` |
| `<cmd>write<CR>` | `<cmd>write<CR>` |
| `<cmd>:write<CR>` | `<cmd>write<CR>` |
| `:cprev<CR>zz` | `<cmd>cprev<CR>zz` |

Keys-mode actions (`actionType='keys'`) are **never** normalized — they are emitted verbatim.

**`desc` fallback from catalog entry:**

The `desc` option in the opts table is resolved with this priority:
1. **User description** (non-empty after trim) — always wins.
2. **Catalog fallback** — when the action is `run-action` in `catalog` mode with a valid `selectedActionKey`: use the catalog entry's `shortDescription`, falling back to `label`.
3. **Omit `desc`** — when both of the above are unavailable.

## Adding a New Section

### 1. Define the section ID

```typescript
// sections/types.ts
export type SectionId =
  | 'leader-key'
  | 'neovim-options'
  | 'plugins'
  | 'lsp'
  | 'colorscheme'
  | 'highlights'
  | 'project-keymaps'
  | 'callable-functions'
  | 'my-new-section'  // Add here

export const SECTION_ORDER: readonly SectionId[] = [
  'leader-key',
  'neovim-options',
  'callable-functions',
  'plugins',
  'lsp',
  'colorscheme',
  'highlights',
  'my-new-section',    // Add in correct position
  'project-keymaps',
]
```

### 2. Create the section generator

```typescript
// sections/my-new-section.ts
import type { SectionResult } from '../types'
import { LuaBuilder } from '../utils/lua-builder'

export interface MyNewSectionInput {
  data: MyDataType[]
}

export function generateMyNewSection(input: MyNewSectionInput): SectionResult {
  const diagnostics: SectionGenerationDiagnostic[] = []

  if (input.data.length === 0) {
    return { id: 'my-new-section', code: [], diagnostics }
  }

  const builder = new LuaBuilder()

  for (const item of input.data) {
    builder.line(`-- ${item.name}`)
    builder.line(`vim.api.my_call("${item.value}")`)
  }

  return {
    id: 'my-new-section',
    code: builder.build().split('\n'),
    diagnostics,
  }
}
```

### 3. Wire into the orchestrator

```typescript
// orchestrator/phase-coordinator.ts, in Phase 5:
emitProgress({ type: 'generating-sections', sectionName: 'my-new-section' })
const myResult = generateMyNewSection({
  data: loadResult.myData.data,
})
sectionResults.push(myResult)
```

### 4. Export from sections index

```typescript
// sections/index.ts
export { generateMyNewSection } from './my-new-section'
```

### 5. Add tests

```typescript
// sections/__tests__/my-new-section.test.ts
import { describe, expect, it } from 'vitest'
import { generateMyNewSection } from '../my-new-section'

describe('generateMyNewSection', () => {
  it('generates correct Lua', () => {
    const result = generateMyNewSection({
      data: [{ name: 'test', value: 'hello' }],
    })
    expect(result.id).toBe('my-new-section')
    expect(result.code.join('\n')).toContain('vim.api.my_call("hello")')
  })

  it('returns empty for no data', () => {
    const result = generateMyNewSection({ data: [] })
    expect(result.code).toHaveLength(0)
  })
})
```

## How Sections Are Assembled

The assembler (`orchestrator/assemble.ts`) processes sections in `SECTION_ORDER`:

1. Sorts sections by their position in `SECTION_ORDER`
2. Deduplicates (warns on duplicates)
3. Emits header comment
4. Initializes callable registry: `_G._vinela_callables = _G._vinela_callables or {}`
5. For each section in order:
   - If `callable-functions`: emit callable graph snippets
   - Otherwise: emit section comment + code lines
6. Emit startup execution snippets last

The `callable-functions` section is special -- it's not generated by a section generator but by graph generation (Phase 6). The assembler inserts it at the correct position in the order.

## Related Documentation

- [Architecture](./architecture.md) -- How sections fit in the 9-phase pipeline
- [Node Generators](./node-generators.md) -- Graph-based code generation (vs section-based)
- [Testing](./testing.md) -- Section test patterns
