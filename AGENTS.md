> **Important**: AI agents working on this project MUST read this file first and update it when making significant changes.

## Project Overview

**vinela** is a GUI desktop application for visually creating and managing Neovim configurations. Users can configure Neovim without deep knowledge of Lua or Neovim internals.

Pre-release rename note: this project now uses the `vinela` identity without compatibility migrations. Old private/dev app data or pre-rename projects may need manual reset or rename.

### Core Philosophy
- Users shouldn't need to know Lua to configure basic Neovim functionality
- Visual node-based graph editor for complex logic flows
- Plugin schemas provide UI configuration and generic generation metadata for plugins
- Generated Lua output that actually works
- **Strong typing throughout** - No implicit `any`, strict null checks, discriminated unions
- **No named-plugin core branches** — plugin behavior/config belongs in schema JSON data; if a plugin needs new behavior, add a generic schema capability instead of branching on `schema.id`
- **No backwards migration work in this refactor** — pre-public schema/runtime changes may require manual private-project reset/update unless a later human-approved generic migration design exists

---

## Working Principles (all agents, every task)

### 1. Least code wins

Climb this ladder and stop at the first rung that holds:

1. **Does it need to exist?** Speculative need → skip it, say so in one line.
2. **Already in this repo?** A helper, type, store factory, or pattern that already exists → reuse it.
3. **Stdlib / platform / already-installed dep does it?** Use it. Never add a dependency for what a few lines cover.
4. **Can it be one line?** One line.
5. **Only then**: the minimum code that works.

Forbidden without an explicit request: interfaces with one implementation, factories for one product, config for a value that never changes, scaffolding "for later", abstraction layers with one caller. Deletion beats addition. Boring beats clever. The shortest working diff wins.

**Never lazy about understanding the problem.** The ladder shortens the solution, never the reading. Trace the real flow first, then pick a rung. A bug fix targets the root cause — grep the callers before patching one path.

**Leave one runnable check.** Non-trivial logic (a branch, a loop, a parser, a generator path) gets the smallest test that fails if the logic breaks. Trivial one-liners need none — YAGNI applies to tests too.

**Never simplify away**: input validation at trust boundaries, error handling that prevents data loss, strict-TypeScript guarantees, accessibility basics, or anything explicitly requested.

### 2. Ask before big decisions

Stop and ask via the `question` tool — before writing the plan or the code — when the task involves:

- a new dependency, or a new file/module/feature directory
- a change to a shared type, plugin-schema contract, or generated-Lua output shape
- deleting or changing existing user-visible behavior
- more than one reasonable approach where the choice is a product/UX call
- work that grows past what the user described

Ask concrete either/or questions with a recommendation. Do not ask about things you can research, and do not defer decisions into an "Open Questions" section — that is where questions go to die.

### 3. Reporting to the user is extremely concise

When reporting to the user: **be extremely concise and sacrifice grammar for the sake of concision.** Fragments over sentences. No preamble, no restating the request, no feature tours, no essays defending a design. If the explanation is longer than the code, delete the explanation.

This applies to **user-facing messages only**. Plan files, handoff prompts between agents, and question-tool options stay complete — a telegraphic handoff drops context the next agent needs.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Tauri 2.0 (cross-platform desktop, also the runtime) |
| Frontend | React + TypeScript |
| Dev Tooling | Bun (package manager, bundler, script runner — NOT Node.js) |
| Styling | TailwindCSS |
| UI Components | shadcn/ui |
| Node Editor | React Flow |
| State | Zustand (with undo/redo middleware) |
| Linting | Biome |
| Testing | Vitest |

### Development Commands

- **Run tests**: `bun run test` (uses Vitest — do NOT use `bun test`)
- **Lint**: `bun run lint` (Biome with `--error-on-warnings`; warnings are fail-closed)
- **Bump app version**: `bun run version:bump <patch|minor|major|VERSION>`; verify with `bun run version:bump --check`
- **Do NOT run full builds** — Tauri builds are slow/heavy; avoid `bun run build` or `cargo build` unless explicitly needed

---

## Strong Typing Requirements

Strict TypeScript is enforced via `tsconfig.json` (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`).

### Required Patterns

1. **Discriminated unions for results** — never optional error fields:
   ```typescript
   type Result = { success: true; data: T } | { success: false; error: string }
   ```

2. **Discriminated unions for variants** — use a discriminator field for type narrowing:
   ```typescript
   type NodeData =
     | { nodeType: 'trigger'; triggerType: 'startup' }
     | { nodeType: 'action'; label: string }
   ```

3. **Type guards** alongside discriminated unions for narrowing.

4. **Centralized types** in `src/shared/types/` — re-exported from `index.ts`.

5. **No `any` or weak types** — use concrete types, not `Record<string, unknown>`.

6. **Explicit return types** on all public functions.

### Key Type Files

| File | Purpose |
|------|---------|
| `src/shared/types/project.ts` | Project, LoadedProject, RecentProject, AppSettings |
| `src/shared/types/graph.ts` | NodeData (union), GraphNode, Graph, Port |
| `src/shared/types/schema.ts` | PluginSchema, SchemaOption |
| `src/shared/types/validation.ts` | ValidationResult, ValidationError |
| `src/shared/types/neovim-options.ts` | NeovimOptionDefinition, OptionPreset, ProjectNeovimOptionsFile |

---

## Architecture Patterns

### State Management (Zustand)

All stores use factory functions from `@/shared/lib/store`:

| Factory | Use When |
|---------|----------|
| `createTemporalStore<T>()` | Store needs undo/redo (uses zundo middleware) |
| `createStore<T>()` | Simple store (no undo) |

Both use **Immer middleware** — mutate state directly inside `set()`:
```typescript
set((state) => {
  state.field = newValue  // Immer handles immutability
})
```

**Key conventions**:
- Stores contain both **state and actions** in one interface
- Every store has `resetForProjectClose()` to prevent cross-project state bleed
- **Generation counters** prevent stale async results from overwriting newer state
- **In-flight deduplication** via module-level variables tracks pending operations

### Storage Abstraction

Three-layer data flow: **UI → Zustand stores → Storage API → Backend**

- `storage-api.ts` routes to the correct backend (Tauri filesystem or in-memory Map)
- Auto-detects Tauri at runtime; falls back to memory when unavailable
- Projects at `/memory/*` always use memory backend
- Two namespaces: `App` (global settings) and `Project` (per-project data)

### Import Conventions

- **Path alias**: `@/` maps to `src/` (configured in tsconfig)
- **Cross-feature imports**: Always use `@/features/...` or `@/shared/...`
- **Within a feature**: Relative imports are fine (`../store`, `./utils`)
- **Never** use relative imports across feature boundaries
- **Barrel exports**: Each feature and `src/shared/types/` has `index.ts`

### Testing Conventions

- **Framework**: Vitest with jsdom environment, globals enabled
- **Run tests**: `bun run test` (NOT `bun test`)
- **Mock storage**: Always mock `@/shared/lib/storage-api`, never touch real filesystem
- **Reset stores**: Call `resetForProjectClose()` in `beforeEach`
- **Test state transitions**: Use `getState()` to inspect store state after actions
- **Lua generator tests**: Use `GraphBuilder` DSL for building test graphs fluently
- **Lua syntax validation**: integration tests need a Neovim-compatible Lua compiler on PATH (`nvim`, `luajit`, `luac5.1`, `lua5.1`). Details: `docs/generated-config-testing.md`
- **Lua callable-key assertions**: Use `expectedCallableRef` / `expectedAutocmdCallbackRef` or custom matchers (`toContainCallableRegistration`, `toContainCallableInvocation`, `toContainAutocmdCallbackRegistration`) — do not hard-code `_G._vinela_callables["..."]` literals in tests

---

## Project Structure

```
vinela/
├── src/                      # Frontend React code
│   ├── app/                  # Shell, routing, providers
│   ├── features/             # Feature-based organization
│   │   ├── plugins/          # Plugin management
│   │   ├── graph-editor/     # Node-based visual editor
│   │   ├── settings/         # Settings UI
│   │   ├── keymaps/          # Keymap management
│   │   ├── projects/         # Multi-project management
│   │   ├── neovim/           # Neovim detection, backup, deploy
│   │   └── lua-generator/    # Lua code generation
│   ├── shared/               # Shared components, hooks, utils
│   │   ├── lib/              # fs.ts, paths.ts, settings.ts, storage-*.ts
│   │   └── types/            # Centralized TypeScript types
│   └── schemas/              # Built-in plugin schemas
│
├── src-tauri/                # Rust backend (minimal - plugins only)
│
├── docs/                     # Project documentation
│   ├── interactive-tutorial.md  # In-app tutorial content (not agent onboarding)
│   └── lua-generator/        # Lua generator docs (8 files)
│
├── dev-data/                 # Dev mode project storage (gitignored)
├── example-vinela-project/   # Checked-in public Vinela project fixture
│
├── .opencode/                # Project automation and skills (agents local/gitignored)
│
└── AGENTS.md                 # THIS FILE
```

---

## Feature Summary

All planned features are implemented:

- **Project management** — Create/open/switch projects, start screen, recent projects, and desktop/browser memory-mode creation of user-named projects from the checked-in fixture at a user-selected final folder/path
- **Graph editor** — Multi-graph management (sidebar, tabs, CRUD), callable/return/graph-ref nodes, disable/reorder with transitive dependency tracking
- **Plugin & schema system** — Three-tier loading (built-in → global → project-local), project-local-default GitHub/JSON imports, source-tier deletion for uninstalled user schemas, validation, config UI, export standalone, and per-project installed-plugin `installOverride` metadata for user-controlled `vim.pack` version pinning
- **Bundled repository metadata seeding** — Built-in plugin/color-scheme Author/stars/date metadata comes from a committed repository snapshot refreshed by maintainers/dev scripts; no runtime end-user metadata fetch is required for normal browsing
- **Action nodes** — 7 Neovim action types + plugin/builtin nodes
- **Neovim options** — 67 options, presets, categories
- **Keymaps** — Conflict detection, graph integration
- **Settings** — App preferences, per-project settings
- **Neovim detection & backup** — Auto-detect Neovim, backup existing config before deploy
- **Lua code generation** — 9-phase pipeline, pre-generation diagnostics, deploy to Neovim config, export standalone
- **In-memory storage** — Browser-compatible mode for development/testing

---

## Documentation Reference

| I need to... | Go to |
|-------------|-------|
| Work on Lua code generation | `docs/lua-generator/` (start with `README.md`) |
| Create, review, or validate plugin schemas | Public contract: `schema/plugin-schema.schema.json`; complete external workflow and authoring guidance: `skills/vinela-plugin-schema/`; validator maintenance: `docs/schema-validator-maintenance.md` |
| Look up Neovim API details | Installed Neovim runtime docs through the `nvim-research` skill |
| See the in-app tutorial content | `docs/interactive-tutorial.md` |
| Work on bundled color-scheme previews / activation metadata | `docs/colorscheme-catalog.md` |
| Regenerate or debug the external plugin-schema validator | `docs/schema-validator-maintenance.md` |
| Validate generated Lua / debug headless startup | `docs/generated-config-testing.md` |

### Lua Generator Docs (`docs/lua-generator/`)

8 files covering the full pipeline: `README.md` (overview), `architecture.md` (9-phase pipeline), `node-generators.md` (per-node-type generators), `traversal.md` (graph indexing, DFS, Kahn's), `sections.md` (top-level section generators), `diagnostics.md` (pre-generation checks), `testing.md` (test patterns, GraphBuilder DSL), `common-issues.md` (gotchas).

**Reading order**: README.md → architecture.md → specific file for your task.

> Docs are living documents — when in doubt, trust the source code.

---

## Agent Responsibilities

1. **Read this file first** to understand project context
2. **Update this file** when adding features, changing architecture, or completing milestones

---

## Key Design Decisions

### Storage Architecture
- **Projects are self-contained folders** with `project.json`, `graphs/`, and `schemas/` at the project root
- **App settings in system AppData** (app-settings.json, global schemas/, backups/)
- **Dev mode uses `./dev-data/`** when `import.meta.env.DEV` is true
- **Generated Lua outputs to Neovim config directory** (`~/.config/nvim/init.lua` by default, configurable)

### Project Management
- Start screen with recent projects + Open/New actions
- Recent projects as absolute paths with cached name (stale entries auto-removed)
- Project name is editable and independent of folder name
- Desktop and browser memory-mode start screens can create a user-named project from the checked-in fixture at a user-selected final folder/path

### Schema System
- **Three-tier loading**: built-in → global → project-local (later overrides earlier by ID)
- **Manual imports and deletion**: GitHub/JSON imports select project-local (default) or global storage; uninstalled global/project schemas can be deleted from their source tier.
- **Schema authoring sources**: `schema/plugin-schema.schema.json` is the public machine contract; `skills/vinela-plugin-schema/` is the complete external authoring and offline-validation guide. Internal docs describe maintenance only and must not duplicate the authoring contract.
- **Export standalone**: copies used global schemas to project for sharing
- **Install target precedence**: generated `vim.pack` metadata resolves user `installOverride` first, then schema `pack` defaults
- **Schema-driven generation policy**: built-in, global, and project-local schemas must all be able to use every generic plugin-generation capability available in core code
- **`schema.id` usage boundary**: use schema ids for identity, diagnostics, and lookup only — never to select plugin generation/runtime/migration behavior
- **External authoring validator**: `skills/vinela-plugin-schema/` ships a public Node CLI plus committed generated validator snapshots. Application validation stays in `src/shared/lib/schema-validation.ts` and `src/features/lua-generator/utils/schema-shape-invariants.ts`. Never hand-edit generated validator modules. Regenerate/drift-check: `bun run schema:validator:build` / `bun run schema:validator:check`. Full contract: `docs/schema-validator-maintenance.md`
- **Plugin command catalogs**: schemas provide typed Ex-command params, token emission, and command templates; those capabilities work identically for built-in, global, and project-local schemas. Schema authors must audit documented setup, keymaps, commands, exports, and events before structural validation. Command templates may provide a preset-specific usage example; omission inherits the base Ex-command example.

### Code Quality
- Strong typing enforced (strict TypeScript, discriminated unions)
- TypeScript-first architecture with Tauri plugins for I/O (`plugin-fs`, `plugin-shell`, `plugin-dialog`)
- Marker comments identify generated files
- **Biome lint is fail-closed on warnings** — `bun run lint` runs `biome check --error-on-warnings .`; do not weaken rules globally to silence findings
- **Cognitive-complexity suppressions** must be function-local `biome-ignore` comments with a concrete rationale; no file- or rule-level disables
- **Neovim 0.12 baseline**: generated configuration targets `MIN_SUPPORTED_NEOVIM_VERSION = '0.12.0'`; pre-flight captures a request-scoped target snapshot and emits a non-blocking warning when the locally detected binary is older or undetected (suppressed in memory mode)

### Graph System
- Plugin management uses `vim.pack` (native Neovim)
- Graphs are JSON files in `graphs/` at the project root; projects are isolated
- **Entry-node based behavior** — no graph "type" field; entry nodes determine behavior:
  - `On Startup` — trigger execution
  - `Callable Entry` — makes graph callable (max 1 per graph, defines params/returns)
  - Event/keypress triggers use `Create Autocmd` and `Set Keymap` action nodes
- Graph-ref nodes dynamically show ports matching target callable graph's contract
- **Disable/reorder**: user intent (checkbox) vs effective state (computed) separation; metadata-only writes prevent stale overwrites; transitive disable via O(V+E) reverse adjacency + BFS

### Function param tiering (run-function UX)

- Function params may include `tier` (`basic`/`advanced`) and `group` metadata for progressive disclosure.
- Advanced params are hidden by default; params with stored defaults remain visible to avoid “lost value” UX.
- Dotted param names (e.g. `layout.preset`) are emitted as nested Lua tables.
- Catch-all `opts` params should be treated as augmentation layers; structured fields win on key conflicts.

### Direct filesystem deploy contract (Rust `lib.rs`)

- Generation is in-memory; deploy/direct-write path preparation lives in `src-tauri/src/lib.rs` (`deploy_to_path`, `write_text_file_direct`, `mkdir_direct`).
- Supports safe in-home **directory** symlinks, including dangling directory links whose normalized target is under canonical `$HOME`; creates missing authorized suffixes with checked single-level `create_dir` without replacing links.
- Rejects every pre-existing final **output-file** symlink (dangling, in-home, outside-home, chains); writes only through `canonical_parent.join(file_name)`, never raw `outputPath` containing directory aliases.
- Parent failures use stable `Failed to create parent directory` wrapper → frontend `directory-creation-failed` (prefix-first, including permission denials under that prefix). Final-leaf policy and unrelated write failures → `write-failed`.
- Residual threat boundary: portable path APIs detect observable same-user identity races but are not descriptor-/handle-relative atomic protection; full hardening is a separate cross-platform project.

**Last Updated**: Aug 5, 2026. Pre-public cleanup removed temporary private updater tooling from the public snapshot; bundled Neovim docs/examples remain replaced by installed runtime docs; first-party licensing remains AGPL-3.0-only.
