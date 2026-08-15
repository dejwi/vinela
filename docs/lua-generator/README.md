# Lua Generator

> Canonical reference for the `src/features/lua-generator/` module.
> This documentation is the authoritative source for understanding, extending, and debugging the Lua code generation pipeline.

## What is lua-generator?

The lua-generator is **Step 10** of the vinela project -- the final step that converts the user's visual graph-based Neovim configuration into a working `init.lua` file. It takes graphs, plugin configurations, keymaps, Neovim options, and other project data, then produces valid Lua code that Neovim can execute.

Plugin setup generation is schema-driven: bundled schemas, global schemas, and project-local schemas all use the same generic generator capabilities. Do not add plugin-name branches in core generator code; extend the schema model generically instead.

## High-Level Architecture

```
User clicks "Generate"
        |
        v
+------------------+     +-------------------+     +------------------+
|   UI Components  | --> |   Zustand Store    | --> |   Orchestrator   |
|  (GenerateButton |     | (generation-store) |     | (9-phase pipeline|
|   GenerateDialog)|     |                    |     |  coordinator)    |
+------------------+     +-------------------+     +------------------+
                                                           |
                    +--------------------------------------+
                    |              |              |         |
                    v              v              v         v
            +-----------+  +-----------+  +----------+  +--------+
            | Data      |  | Pre-Gen   |  | Section  |  | Graph  |
            | Loader    |  | Checks    |  | Gens     |  | Gen    |
            | (Phase 2) |  | (Phase 3) |  | (Phase 5)|  |(Phase 6|
            +-----------+  +-----------+  +----------+  +--------+
                                                           |
                                                    +------+------+
                                                    |             |
                                                    v             v
                                              +-----------+ +-----------+
                                              | Traversal | |   Node    |
                                              | (D2)      | | Generators|
                                              | indexes,  | | (D3)      |
                                              | exec-flow | | per-type  |
                                              +-----------+ +-----------+
                                                    |             |
                                                    v             v
                                              +-------------------------+
                                              |  CompilationUnit[]      |
                                              +-------------------------+
                                                        |
                                                        v
                                              +-------------------------+
                                              |  Assembly (Phase 7)     |
                                              |  -> init.lua string     |
                                              +-------------------------+
                                                        |
                                                        v
                                              +-------------------------+
                                              |  Deploy / Export        |
                                              |  -> ~/.config/nvim/     |
                                              +-------------------------+
```

## Entry Points and Public API

### Primary Entry Point

```typescript
import { generateInitLua } from '@/features/lua-generator'

const result = await generateInitLua({
  projectPath: '/path/to/project',
  signal: abortController.signal,
  onProgress: (phase) => console.log(phase),
})

if (result.success) {
  console.log(result.initLua)       // The generated Lua code
  console.log(result.diagnostics)   // Warnings (no errors if success)
  console.log(result.metadata)      // Stats: lines, timing, counts
}
```

### Deploy

Generate is filesystem-free: it returns `init.lua` in memory only. Deploy writes to the configured Neovim output path (default `~/.config/nvim/init.lua`). The frontend supplies `parentDir` as a validated ancestor of `outputPath`; Rust resolves safe in-home directory symlinks (including dangling directory links whose normalized target is under `$HOME`), creates missing authorized suffixes with checked single-level directory creation, and writes only through the revalidated canonical output directory plus the configured file name. Pre-existing output-file symlinks are rejected without following or replacing them. Outside-home directory destinations, symlink cycles, non-directory components, observed identity races, and permissions remain failures. Parent errors beginning `Failed to create parent directory` map to `directory-creation-failed` (including permission denials under that prefix). Backup-before-overwrite for ordinary existing files is unchanged. Path-based creation detects observable same-user races but is not descriptor-relative atomic protection.

```typescript
import { deployGeneratedConfig } from '@/features/lua-generator'

const result = await deployGeneratedConfig({
  projectId: 'abc',
  projectPath: '/path/to/project',
  initLua: generatedCode,
})
```

### Export

```typescript
import { exportProject } from '@/features/lua-generator'

const result = await exportProject({
  projectPath: '/path/to/project',
  destinationPath: '/path/to/export',
  includeSourceGraphs: true,
}, generatedCode)
```

### Key Re-exports from `index.ts`

| Export | Purpose |
|--------|---------|
| `generateInitLua` | Main generation function |
| `deployGeneratedConfig` | Write to Neovim config dir |
| `exportProject` | Export standalone project |
| `GenerateButton`, `GenerateDialog` | UI components |
| `useGenerationStore` | Zustand store for UI state |
| `useLuaPreview` | Shiki syntax highlighting hook |
| `DiagnosticsCollector` | Diagnostic accumulation |
| `LuaBuilder` | Fluent Lua code builder |
| `serializeValue` | JS value -> Lua literal |
| `sanitizeLuaIdentifier` | Make valid Lua identifiers |

## Directory Structure

```
src/features/lua-generator/
|-- index.ts                    # Barrel exports (public API)
|-- types.ts                    # Shared types (414 lines)
|-- lua-utils.ts                # Lua reserved words, identifier sanitization
|-- store.ts                    # Zustand store for generation state
|
|-- orchestrator/               # 9-phase pipeline coordinator
|   |-- index.ts                # Re-exports
|   |-- phase-coordinator.ts    # Main pipeline (661 lines)
|   |-- data-loader.ts          # Parallel project data loading
|   |-- graph-generation.ts     # D2+D3 integration
|   |-- traverse.ts             # Bridge to traversal module
|   |-- assemble.ts             # Final init.lua assembly
|   |-- pre-generation-checks.ts# Runs all diagnostic checks
|   |-- result-builder.ts       # Builds GenerationResult
|   |-- dispatcher.ts           # Re-exports generator registry
|
|-- traversal/                  # Graph traversal & indexing (Domain 2)
|   |-- README.md               # Traversal-specific docs
|   |-- types.ts                # Core traversal types
|   |-- indexes.ts              # O(V+E) graph indexing
|   |-- exec-traversal.ts       # DFS execution flow traversal
|   |-- data-dependencies.ts    # Kahn's algorithm for data deps
|   |-- cycle-detection.ts      # Cycle detection (exec + data)
|   |-- variable-naming.ts      # Deterministic variable names
|
|-- generators/nodes/           # Per-node-type code generators (Domain 3)
|   |-- types.ts                # GenerationContext, NodeGenerator interface
|   |-- register.ts             # Central generator registry
|   |-- callable-entry.ts       # Callable function definitions
|   |-- return.ts               # Return statements
|   |-- trigger/                # Trigger generators
|   |   |-- on-startup.ts       # Startup trigger
|   |-- control/                # Control flow generators
|   |   |-- condition.ts        # If/else branching
|   |   |-- loop.ts             # For/while/each loops
|   |-- action/                 # Neovim action generators
|   |   |-- set-option.ts       # vim.opt.*
|   |   |-- set-keymap.ts       # vim.keymap.set()
|   |   |-- set-variable.ts     # vim.g/b/w/t/v.*
|   |   |-- run-command.ts      # vim.cmd() / nvim_feedkeys()
|   |   |-- create-autocmd.ts   # nvim_create_autocmd()
|   |   |-- set-highlight.ts    # nvim_set_hl()
|   |   |-- get-variable.ts     # Legacy variable reader
|   |   |-- call-function.ts    # Lua/Vim function calls
|   |-- advanced/               # Advanced node generators
|   |   |-- code-block.ts       # User-defined Lua code
|   |   |-- graph-ref.ts        # Cross-graph calls
|   |   |-- plugin-action.ts    # Deprecated plugin action
|   |-- builtin/                # Builtin node generators
|   |   |-- require-module.ts   # require('module')
|   |   |-- check-feature.ts    # vim.fn.has('feature')
|   |   |-- check-platform.ts   # vim.fn.has('platform')
|   |   |-- get-variable.ts     # Modern variable reader
|   |   |-- ui-notify.ts        # vim.notify()
|   |   |-- open-file.ts        # vim.cmd('edit …')
|   |   |-- delay.ts            # vim.defer_fn() wrapper
|   |   |-- prompt.ts           # vim.fn.input()
|   |-- run-function.ts         # luaCall template executor
|   |-- shared/                 # Shared generator utilities
|       |-- diagnostics.ts      # Standard diagnostic codes
|       |-- input-resolver.ts   # Input port resolution
|       |-- lua-literal.ts      # Value serialization helpers
|       |-- lua-emit.ts         # LuaBuilder integration helpers
|       |-- output-vars.ts      # Output variable naming
|
|-- sections/                   # Top-level section generators
|   |-- types.ts                # SECTION_ORDER, SectionId
|   |-- leader-key-section.ts
|   |-- neovim-options-section.ts
|   |-- plugin-section.ts
|   |-- lsp-section.ts
|   |-- colorscheme-section.ts
|   |-- highlight-section.ts
|   |-- project-keymaps-section.ts
|
|-- diagnostics/                # Pre-generation diagnostic checks
|   |-- types.ts                # DiagnosticCategory, PreGenerationCheck
|   |-- collector.ts            # DiagnosticsCollector class
|   |-- index.ts                # Check registry, utilities
|   |-- checks/                 # Individual check implementations
|       |-- duplicate-ids.ts
|       |-- empty-graphs.ts
|       |-- invalid-graph-refs.ts
|       |-- disconnected-entry-points.ts
|       |-- disabled-dependencies.ts
|       |-- circular-dependencies.ts
|       |-- missing-required-ports.ts
|       |-- type-mismatches.ts
|       |-- orphaned-nodes.ts
|       |-- invalid-config.ts
|       |-- code-block-validation.ts
|
|-- deploy/                     # Deploy and export
|   |-- deploy.ts               # Write to Neovim config
|   |-- export.ts               # Export standalone project
|   |-- path-resolution.ts      # Path expansion utilities
|
|-- components/                 # React UI components
|   |-- GenerateButton.tsx
|   |-- GenerateDialog.tsx
|   |-- GenerationProgress.tsx
|   |-- LuaPreview.tsx
|   |-- PreFlightPanel.tsx
|   |-- DiagnosticList.tsx
|   |-- DeployPanel.tsx
|
|-- hooks/                      # React hooks
|   |-- useLuaPreview.ts        # Shiki syntax highlighting
|
|-- utils/                      # Lua code generation utilities
|   |-- lua-builder.ts          # Fluent Lua code builder
|   |-- lua-serialize.ts        # JS -> Lua value serialization
|   |-- lua-string.ts           # Lua string escaping
|   |-- indent.ts               # Indentation utilities
|   |-- config-merge.ts         # Plugin config merging
|
|-- __tests__/                  # Test utilities and fixtures
    |-- index.ts                # Test barrel exports
    |-- utils/
    |   |-- graph-builder.ts    # Fluent graph construction DSL
    |   |-- lua-validator.ts    # luac/nvim syntax validation
    |   |-- snapshot.ts         # Snapshot normalization
    |   |-- temp-project.ts     # Temp project creation
    |-- fixtures/
        |-- graphs/             # Pre-built graph fixtures
        |-- projects/           # Pre-built project fixtures
```

## Related Documentation

| Document | What it covers |
|----------|---------------|
| [Architecture](./architecture.md) | 9-phase pipeline deep dive, data flow, key abstractions |
| [Node Generators](./node-generators.md) | How to add/modify node generators |
| [Traversal](./traversal.md) | Graph indexing, exec flow, data dependencies |
| [Sections](./sections.md) | Top-level section generators |
| [Diagnostics](./diagnostics.md) | Pre-generation checks |
| [Testing](./testing.md) | Test patterns and utilities |
| [Common Issues](./common-issues.md) | Lessons learned, gotchas, debugging |
