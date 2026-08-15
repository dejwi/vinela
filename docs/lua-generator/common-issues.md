# Common Issues

> Lessons learned, gotchas, and debugging tips for the lua-generator.

## Schema-shape vs runtime-overlap invariants

## Do not fix plugins with named branches

If a plugin needs new generation behavior, do **not** add a branch keyed by `schema.id`, plugin name, or a built-in schema allowlist. Add a generic schema capability, document it for schema authors, and then express the plugin behavior in schema JSON.

Two distinct invariants govern schemas with `type: 'lua'` "raw" options:

1. **Schema-shape invariants** (`assertSchemaShape`, runs at schema load /
   pre-generation): validates effective-key syntax and uniqueness only.
   It deliberately does **not** ban typed descendants under a lua parent's
   emitted key. A schema author may legitimately pair a "raw escape hatch"
   (e.g. `picker.sourcesRaw` aliased to `picker.sources`) with typed
   descendants (e.g. `picker.sources.files.hidden`).

2. **Runtime overlap invariants** (`assertNoRawTypedSubtreeOverlap`, runs
   per-plugin during `generatePluginSetup`): hard-fails only when the
   *user* sets both the raw subtree root and one or more typed descendants
   in the same emitted subtree. Empty-string / `{}` / `nil` raw values
   count as "not set". The error message names both conflicting keys and
   the shared emitted path.

If you see a "lua-typed option … cannot have typed descendants" error,
that came from an older version of `assertSchemaShape` and should not
appear in current code; check that your branch is up to date.

## Port ID Mismatches

## Changing the callable key format

1. Update `formatCallableId` (and/or `shortIdFromUuid`) in `src/features/lua-generator/lua-utils.ts`.
2. Update format-pinning tests in `src/features/lua-generator/utils/__tests__/lua-utils.test.ts` and the canonical UUID pin in `src/features/lua-generator/orchestrator/__tests__/full-pipeline.test.ts`.
3. Run `bun run test`.
4. If snapshots changed, run `bun run test -- -u` once.
5. If tests outside the pinning locations fail, they likely contain hard-coded callable literals; migrate them to callable helpers/matchers.

**This is the #1 source of bugs in the lua-generator.**

### The Problem

Port IDs must be identical across three systems:
1. **UI node components** (React Flow) -- define visual ports
2. **Graph type definitions** -- define the data model
3. **Generator/traversal code** -- consume port IDs

If any system uses a different port ID, edges silently fail to connect or data silently fails to flow.

### Where Port IDs Are Defined

| System | Location | Example |
|--------|----------|---------|
| UI nodes | `src/features/graph-editor/components/nodes/` | Port handle with `id="done"` |
| Type definitions | `src/shared/types/graph.ts` | `ActionNodeData.config` |
| Edge classifier | `src/features/lua-generator/traversal/indexes.ts` | `isExecEdge()` function |
| Node generators | `src/features/lua-generator/generators/nodes/` | `context.inputBindings['value']` |
| Diagnostic checks | `src/features/lua-generator/diagnostics/checks/` | Port validation |

### Common Mismatch Scenarios

#### Exec port name disagreement

```typescript
// UI defines port as 'on-event'
<Handle id="on-event" type="source" />

// But generator checks for 'on-trigger'
const callbackLines = context.renderExecFromPort(node.id, 'on-trigger')
// Result: empty array, callback code never generated
```

**Fix:** Always check the UI component's port IDs and match them exactly in the generator.

#### Loop port name disagreement

```typescript
// Traversal checks for 'loop' and 'done'
case 'loop':
  return portId === 'loop' || portId === 'done'

// But exec-traversal.ts also checks for 'body' and 'complete'
const bodyEdge = nextNodes.find(e => e.sourcePortId === 'body' || e.sourcePortId === 'loop')
const completeEdge = nextNodes.find(e => e.sourcePortId === 'complete' || e.sourcePortId === 'done')
```

**Why:** Historical port ID changes. The traversal code handles both old and new names for robustness.

#### Dynamic port IDs

For nodes with user-defined ports (code-block, callable-entry, return, graph-ref), port IDs come from the node's configuration data:

```typescript
// Code block: ports defined by data.inputs and data.outputs
node.data.inputs = [{ id: 'my-input', name: 'My Input', dataType: 'string' }]
// Generator must use 'my-input' as the port ID

// Callable entry: ports defined by data.parameters
node.data.parameters = [{ id: 'param1', name: 'Param 1', dataType: 'any' }]
// Generator must use 'param1' as the port ID
```

### Debugging Port ID Issues

1. **Check the edge classifier first:**
   ```typescript
   // traversal/indexes.ts - isExecEdge()
   // If a port is misclassified, the edge goes into the wrong index
   ```

2. **Log the indexed graph:**
   ```typescript
   const indexes = buildGraphIndexes([graph])
   const indexed = indexes.byGraph.get(graphId)!
   console.log('Exec edges:', [...indexed.outgoingExecByNode.entries()])
   console.log('Data edges:', [...indexed.outgoingDataByNode.entries()])
   ```

3. **Check inputBindings in the generator:**
   ```typescript
   generate(node, context) {
     console.log('inputBindings:', context.inputBindings)
     // If a port is missing, the data edge wasn't classified correctly
   }
   ```

4. **Verify with a test:**
   ```typescript
   const graph = new GraphBuilder('g1', 'Test')
     .startupTrigger('t1')
     .action('a1', 'set-option', { /* ... */ })
     .connectExec('t1', 'a1')
     .build()

   // Check that the edge was classified as exec
   const indexes = buildGraphIndexes([graph])
   const indexed = indexes.byGraph.get('g1')!
   const execEdges = indexed.outgoingExecByNode.get('t1')
   expect(execEdges).toHaveLength(1)
   expect(execEdges![0]!.sourcePortId).toBe('exec')
   ```

## Type Mismatches Between Features

### The Problem

The lua-generator imports types from multiple features (`graph-editor`, `plugins`, `keymaps`, etc.). When those features update their types, the generator may break.

### Common Scenarios

#### NodeData union changes

When a new node type is added to the `NodeData` discriminated union in `src/shared/types/graph.ts`, the generator's `resolveGeneratorType()` must handle it:

```typescript
// If a new node type 'my-node' is added to NodeData but not handled:
function resolveGeneratorType(node: GraphNode): string {
  switch (node.data.nodeType) {
    // ... existing cases ...
    // Missing: case 'my-node': return 'my-node'
  }
  // TypeScript will catch this if the switch is exhaustive
}
```

**Prevention:** The `resolveGeneratorType()` switch should be exhaustive. TypeScript will error if a new variant is added to `NodeData` but not handled.

#### Plugin config shape changes

Section generators depend on `InstalledPlugin` and `PluginSchema` types. If the schema format changes, `buildResolvedPlugins()` in the phase coordinator may need updating.

#### Keymap type changes

The project keymaps section depends on `ProjectKeymap` type. If action types are added, the section generator needs a new case.

### Prevention

- Keep types centralized in `src/shared/types/`
- Use discriminated unions with exhaustive switches
- Run `bun typecheck` before committing

## Async/Await Patterns

### The Problem

The orchestrator is async (data loading, deploy), but most generation code is synchronous. Mixing patterns incorrectly can cause subtle bugs.

### Rules

1. **Data loading is async** -- `loadProjectData()` uses `Promise.all` internally; each individual loader is wrapped with its own error-safe helper so one failure doesn't cancel the rest
2. **Section generators are sync** -- Pure functions, no I/O
3. **Graph traversal is sync** -- Pure computation
4. **Node generators are sync** -- Pure functions
5. **Deploy/export are async** -- File system operations

### Common Mistake: Forgetting AbortSignal

```typescript
// BAD: Long-running operation without cancellation check
for (const graph of graphs) {
  const units = traverseGraph(graph, indexes, collector)
  // If user cancels, this keeps running
}

// GOOD: Check signal between operations
for (const graph of graphs) {
  if (options.signal?.aborted) {
    return { success: false, diagnostics: [cancellationDiagnostic] }
  }
  const units = traverseGraph(graph, indexes, collector)
}
```

### Common Mistake: Dynamic Import Timeout

The store uses dynamic imports with timeouts to prevent hangs in Vite preview builds:

```typescript
// store.ts
const IMPORT_TIMEOUT_MS = 10_000

// Wraps dynamic import with timeout
const module = await Promise.race([
  import('./orchestrator'),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Import timeout')), IMPORT_TIMEOUT_MS)
  ),
])
```

If you add new dynamic imports, wrap them with the same timeout pattern.

## Storage Patterns

### Memory Mode

The app can run in browser mode (no Tauri) using in-memory storage. All file operations go through `storage-api.ts` which routes to either `TauriStorageBackend` or `MemoryStorageBackend`.

**Impact on lua-generator:**
- Deploy returns error in memory mode (`errorCode: 'memory-mode'`)
- Export returns error in memory mode
- Data loading works (reads from memory storage)
- Generation works (pure computation)

### Path Handling

```typescript
// GOOD: Use storage-api.ts for all file operations
import { readTextFile, writeTextFile } from '@/shared/lib/storage-api'

// BAD: Direct Tauri imports (breaks memory mode)
import { readTextFile } from '@tauri-apps/plugin-fs'
```

### Stat vs Exists

The deploy module uses `stat()` instead of `exists()` because `exists()` can hang in some Tauri versions:

```typescript
// GOOD: Use stat-based existence check
import { safePathExists } from '@/features/lua-generator/deploy/path-resolution'
const exists = await safePathExists(path)

// BAD: Can hang
import { exists } from '@tauri-apps/plugin-fs'
const fileExists = await exists(path)
```

## Gotchas and Troubleshooting

### 1. Generator Not Found

**Symptom:** `No generator registered for node type: action:my-action`

**Cause:** Generator not registered in `register.ts`, or `initializeGenerators()` not called.

**Fix:** Add registration in `initializeGenerators()`. Note that `initializeGenerators()` is called at module load time (line 134 of `register.ts`).

### 2. Empty Code Output

**Symptom:** Generated `init.lua` is just the header with no content.

**Possible causes:**
- All graphs are disabled
- No entry nodes (triggers or callable-entry) in any graph
- All nodes are orphaned (not connected to entry points)
- Pre-generation checks found errors and aborted

**Debug:** Check `result.diagnostics` for clues.

### 3. Double-Indented Code

**Symptom:** Code inside `if...end` or `for...end` blocks is indented too much.

**Cause:** `renderExecFromPort` returns lines at indent level 0. If you manually indent them before passing to `LuaBuilder.block()`, they get double-indented.

**Fix:** Pass lines directly to `inner.line()` inside a `block()` call:

```typescript
// GOOD
builder.block('if condition then', (inner) => {
  for (const line of renderExecFromPort(node.id, 'true')) {
    inner.line(line)  // block() handles indentation
  }
}, 'end')

// BAD
const lines = renderExecFromPort(node.id, 'true')
const indented = lines.map(l => '  ' + l)  // Don't do this!
builder.block('if condition then', (inner) => {
  for (const line of indented) {
    inner.line(line)  // Double indented!
  }
}, 'end')
```

### 4. Stale Generator Registry

**Symptom:** Tests pass individually but fail when run together.

**Cause:** The generator registry is a module-level singleton. If a test modifies it, other tests see the modification.

**Fix:** Don't modify the registry in tests. If you must, save and restore:

```typescript
beforeEach(() => {
  // Registry is initialized at module load, no need to re-initialize
})
```

### 5. Non-Deterministic Output

**Symptom:** Generated Lua changes between runs even with same input.

**Cause:** Unsorted iteration over Maps or Sets.

**Fix:** All edge lists are sorted by `edgeId`. If you add new iteration, always sort:

```typescript
// GOOD
const edges = [...map.values()].sort((a, b) => a.id.localeCompare(b.id))

// BAD
for (const edge of map.values()) { /* non-deterministic order */ }
```

### 6. LuaBuilder UNCLOSED_BLOCK Error

**Symptom:** `LuaBuilderError: UNCLOSED_BLOCK`

**Cause:** `indent()` called without matching `dedent()`, or `block()` callback throws.

**Fix:** Always use `block()` for paired indent/dedent. If using manual `indent()`/`dedent()`, ensure they're balanced even on error paths.

### 7. Callable Graph Not Found

**Symptom:** `graph-ref` node generates `_G._vinela_callables["undefined"]`

**Cause:** The referenced graph's callable contract wasn't extracted, or the graph ID doesn't match.

**Debug:**
```typescript
// Check callableSymbolByGraphId
console.log('Symbols:', [...context.callableSymbolByGraphId.entries()])
// Check callableContracts
console.log('Contracts:', [...(context.callableContracts?.entries() ?? [])])
```

### 8. Section Diagnostics Suppressed

**Symptom:** Section generator emits a diagnostic but it doesn't appear in the result.

**Cause:** The phase coordinator normalizes section diagnostics. `info`-level diagnostics are intentionally suppressed:

```typescript
// phase-coordinator.ts
if (diagnostic.severity === 'error') {
  collector.addError(normalizedDiagnostic)
} else if (diagnostic.severity === 'warning') {
  collector.addWarning(normalizedDiagnostic)
}
// info diagnostics from sections are intentionally suppressed
```

**Fix:** Use `'warning'` severity for diagnostics that should be visible.

### 9. Snapshot Tests Failing After Timestamp Change

**Symptom:** Snapshot tests fail because the generated header contains a different timestamp.

**Fix:** Use `createStableSnapshot()` which strips timestamps and UUIDs:

```typescript
import { createStableSnapshot } from '@/features/lua-generator/__tests__'

const result = await generateInitLua({ projectPath })
expect(createStableSnapshot(result.initLua!)).toMatchSnapshot()
```

### 10. Deploy Backup Safety

The deploy system has a critical safety invariant: **never overwrite a user's config without a backup**.

```typescript
// deploy.ts safety logic:
// 1. If file exists and is NOT owned by vinela -> create backup
// 2. If backup creation fails -> ABORT (never overwrite without backup)
// 3. If file exists and IS owned by vinela -> skip backup (replaceable)
// 4. If file doesn't exist -> no backup needed
```

If you modify deploy logic, preserve this invariant. The marker comment `-- Generated by vinela` identifies owned files.

**Generate vs Deploy:** generation never touches the filesystem. Deploy (and generic `writeTextFileDirect` backup/restore writes) use the Rust direct-write backend to resolve safe in-home directory symlinks (including dangling directory links whose normalized target is under `$HOME`), create missing authorized suffixes with checked single-level `create_dir`, and write only through the canonical-parent-derived ordinary file path. The frontend passes `parentDir` as a validated ancestor of `outputPath`. Vinela never removes or retargets directory links. Any pre-existing final output-file symlink is rejected, including dangling or in-home links. Outside-home directory destinations, cycles, non-directory components, observed identity races, and permissions remain failures. Parent failures beginning `Failed to create parent directory` map to `directory-creation-failed` even when the underlying cause is permission denial (prefix mapping is intentionally first). Only permission errors outside that prefix map to `permission-denied`; unrelated/final-target failures map to `write-failed`. Backup-before-overwrite behavior is unchanged for ordinary existing files. Checked one-level path creation detects observable same-user races but is not a sandbox guarantee against a malicious same-user actor.

**Troubleshooting directory creation failures:** inspect the full output parent, not only `~/.config`. For example:

```bash
test -d ~/.config/nvim
ls -ld ~/.config/nvim
# If nvim is a directory symlink, inspect its target:
readlink ~/.config/nvim
```

A `test -d ~/.config` success does not establish the state of `~/.config/nvim`. Look for a regular file, symlink to a file, symlink target outside home, or changed authorization at or below the configured output parent. Vinela can create a missing safe directory-link destination but never changes the link. Correct the configured output path or repair the blocking entry manually.

**Troubleshooting output-file symlink rejection:** if deploy fails with a message that vinela will not write through output-file symlinks, configure the real ordinary output file path or repair the `init.lua` link manually. Vinela does not follow or replace final output-file symlinks.

## Related Documentation

- [Architecture](./architecture.md) -- System overview
- [Node Generators](./node-generators.md) -- Generator patterns
- [Traversal](./traversal.md) -- Port ID conventions
- [Testing](./testing.md) -- How to write tests that catch these issues
### Callable key rename behavior

Callable registry keys are derived from `graph.name + short UUID prefix` (6 hex chars).
Renaming a graph changes its emitted callable key on the next regeneration; this is expected.
