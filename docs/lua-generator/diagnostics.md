# Diagnostics

> Pre-generation checks and the diagnostics framework.
> Located in `src/features/lua-generator/diagnostics/`.

## Overview

The diagnostics system validates graphs **before** code generation begins (Phase 3). It catches structural issues, invalid references, missing connections, and configuration errors. Errors block generation; warnings are reported but don't prevent output.

## DiagnosticsCollector

**File:** `diagnostics/collector.ts` (144 lines)

The central accumulator for all diagnostics throughout the pipeline:

```typescript
class DiagnosticsCollector {
  addError(input: Omit<GenerationDiagnostic, 'severity'>): void
  addWarning(input: Omit<GenerationDiagnostic, 'severity'>): void
  hasErrors(): boolean
  hasWarnings(): boolean
  getErrors(): readonly GenerationDiagnostic[]
  getWarnings(): readonly GenerationDiagnostic[]
  getAll(): readonly GenerationDiagnostic[]  // Errors first, then warnings
  merge(other: DiagnosticsCollector): void
  get count(): number
  clear(): void
}
```

### Deduplication

Diagnostics are deduplicated by a composite key: `${id}::${sourceKey}` where `sourceKey` is built from `graphId`, `nodeId`, and `portId`:

```typescript
// These are the same diagnostic (deduplicated):
collector.addError({ id: 'MISSING_INPUT', source: { nodeId: 'n1', portId: 'value' } })
collector.addError({ id: 'MISSING_INPUT', source: { nodeId: 'n1', portId: 'value' } })
// Only one error in collector

// These are different diagnostics:
collector.addError({ id: 'MISSING_INPUT', source: { nodeId: 'n1', portId: 'value' } })
collector.addError({ id: 'MISSING_INPUT', source: { nodeId: 'n2', portId: 'value' } })
// Two errors in collector
```

### Usage Pattern

```typescript
const collector = new DiagnosticsCollector()

// Phase 3: Pre-generation checks
const { collector: checkCollector, hasErrors } = runAllPreGenerationChecks(ctx)
if (hasErrors) {
  return { success: false, diagnostics: checkCollector.getAll() }
}

// Phase 6: Node generators emit diagnostics
generator.generate(node, {
  emitDiagnostic: (d) => {
    if (d.severity === 'error') collector.addError(d)
    else collector.addWarning(d)
  },
})

// Phase 9: Return all collected diagnostics
return { success: !collector.hasErrors(), diagnostics: collector.getAll() }
```

## Diagnostic Types

```typescript
interface GenerationDiagnostic {
  id: string                    // Machine-readable ID (e.g., 'check-empty-graphs')
  severity: 'error' | 'warning'
  category: DiagnosticCategory
  message: string               // Human-readable message
  details?: string              // Additional context
  source?: DiagnosticSource     // Where the issue is
  suggestions?: string[]        // How to fix it
}

interface DiagnosticSource {
  graphId?: string
  graphName?: string
  nodeId?: string
  nodeType?: string
  portId?: string
}

type DiagnosticCategory =
  | 'structure'      // Graph structure (empty, duplicates, orphans)
  | 'connectivity'   // Missing connections, unreachable nodes
  | 'config'         // Invalid configuration values
  | 'syntax'         // Lua syntax issues
  | 'reference'      // Invalid graph/node references
  | 'cycle'          // Circular dependencies
  | 'runtime'        // Unexpected runtime errors
```

## Pre-Generation Checks

### Check Interface

```typescript
interface PreGenerationCheck {
  id: string
  run(ctx: PreGenerationContext, collector: DiagnosticsCollector): void
}
```

### PreGenerationContext

Built by `buildPreGenerationContext()` with precomputed indexes:

```typescript
interface PreGenerationContext {
  graphs: Graph[]
  graphsById: Map<string, Graph>
  nodesByGraph: Map<string, GraphNode[]>
  edgesByGraph: Map<string, GraphEdge[]>
  disableStates: Map<string, GraphDisableState>
  callableContracts: Map<string, GraphCallableContract>
  installedPlugins: InstalledPlugin[]
  schemas: Array<{ schema: PluginSchema; source: string }>
}
```

### All 11 Checks (in execution order)

#### 1. `check-duplicate-ids` (Error)
**File:** `checks/duplicate-ids.ts`

Detects duplicate IDs across the entire project:
- Duplicate graph IDs
- Duplicate node IDs (within a graph)
- Duplicate edge IDs (within a graph)

#### 2. `check-empty-graphs` (Warning)
**File:** `checks/empty-graphs.ts`

Flags graphs that won't produce any code:
- Graphs with zero nodes
- Graphs with no entry points (no trigger or callable-entry)
- Graphs with entry points but no connected executable nodes

#### 3. `check-invalid-graph-refs` (Error/Warning)
**File:** `checks/invalid-graph-refs.ts`

Validates graph-ref nodes:
- Target graph exists (Error)
- Target graph has a callable-entry node (Error)
- Target graph is disabled (Warning)

#### 4. `check-disconnected-entry-points` (Warning)
**File:** `checks/disconnected-entry-points.ts`

Finds callable graphs that are never referenced by any graph-ref node. These define functions that are never called.

#### 5. `check-disabled-dependencies` (Warning)
**File:** `checks/disabled-dependencies.ts`

Detects enabled graphs that depend on disabled graphs via graph-ref edges.

#### 6. `check-circular-dependencies` (Error)
**File:** `checks/circular-dependencies.ts`

Detects cycles in two scopes:
- **Inter-graph:** Circular graph-ref chains (Graph A -> Graph B -> Graph A)
- **Intra-graph:** Circular exec or data edges within a single graph

#### 7. `check-missing-required-ports` (Error)
**File:** `checks/missing-required-ports.ts`

Checks that required input ports are connected:
- Condition nodes: `a` and `b` operands
- Loop nodes: varies by loop type
- Code blocks: all defined inputs
- Graph-ref nodes: required parameters from target contract
- Run-function nodes: function reference

#### 8. `check-type-mismatches` (Error/Warning)
**File:** `checks/type-mismatches.ts`

Validates port type compatibility:
- `void` -> data port (error: exec edge connected to data port)
- Data -> `void` port (error: data edge connected to exec port)
- `string` -> `number` (error: incompatible types; use a code block to convert)

#### 9. `check-orphaned-nodes` (Warning)
**File:** `checks/orphaned-nodes.ts`

Finds nodes not reachable from any entry point via exec flow. These nodes exist in the graph but won't generate any code.

#### 10. `check-invalid-config` (Error/Warning)
**File:** `checks/invalid-config.ts`

Validates node configuration values:
- Empty option names in set-option nodes
- Invalid key sequences in set-keymap nodes
- Unknown autocmd events in create-autocmd nodes
- Empty variable names in set-variable nodes
- Empty highlight group names in set-highlight nodes

#### 11. `check-code-blocks` (Error/Warning)
**File:** `checks/code-block-validation.ts`

Validates code-block nodes:
- Empty code content (error)
- Duplicate port names, case-insensitive (error)
- Reserved Lua word port names (warning)
- Mismatched block keywords -- unclosed `do`/`end`, `if`/`then`, etc. (warning); analysis excludes quoted strings, Lua long-bracket strings/comments at every matching `=` delimiter level, and comments before counting executable Lua keywords
- Missing return statement when outputs are defined (warning)

#### 12. `check-target-neovim-baseline` (Warning)
**File:** `checks/target-neovim-baseline.ts`

Application-level compatibility diagnostic (not plugin-specific). Consumes a request-scoped `targetNeovim` snapshot captured during generation pre-flight — the phase coordinator does **not** re-detect Neovim.

| Snapshot | Diagnostic |
|---|---|
| Detected version `< 0.12.0` | Prominent non-blocking warning: generated config may use unavailable APIs |
| Detected `0.12.0+` (including prerelease suffixes) | No diagnostic |
| Desktop detection failed | Softer non-blocking warning: verify target in Neovim Status |
| Memory/browser mode | Suppressed |

Baseline constant: `MIN_SUPPORTED_NEOVIM_VERSION = '0.12.0'` in `src/shared/lib/neovim-version.ts`.

## Running Checks

### All Checks

```typescript
import { buildPreGenerationContext, runAllPreGenerationChecks } from '@/features/lua-generator/diagnostics'

const ctx = buildPreGenerationContext({ graphs, installedPlugins, schemas })
const { collector, hasErrors } = runAllPreGenerationChecks(ctx)
// runAllPreGenerationChecks creates the collector internally and returns it

if (hasErrors) {
  console.log('Errors:', collector.getErrors())
}
```

### Individual Checks

```typescript
import { checkEmptyGraphs, DiagnosticsCollector } from '@/features/lua-generator/diagnostics'

const collector = new DiagnosticsCollector()
checkEmptyGraphs(ctx, collector)
```

## Adding a New Check

### 1. Create the check file

```typescript
// diagnostics/checks/my-check.ts
import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationCheck, PreGenerationContext } from '../types'

export const MY_CHECK_ID = 'check-my-thing'

export const checkMyThing: PreGenerationCheck = {
  id: MY_CHECK_ID,
  run(ctx: PreGenerationContext, collector: DiagnosticsCollector): void {
    for (const graph of ctx.graphs) {
      const nodes = ctx.nodesByGraph.get(graph.id) ?? []

      for (const node of nodes) {
        if (/* some condition */) {
          collector.addError({
            id: MY_CHECK_ID,
            category: 'config',
            message: `Node "${node.id}" has an issue`,
            source: {
              graphId: graph.id,
              graphName: graph.name,
              nodeId: node.id,
              nodeType: node.data.nodeType,
            },
            suggestions: ['Fix the issue by doing X'],
          })
        }
      }
    }
  },
}
```

### 2. Register the check

```typescript
// diagnostics/checks/index.ts
export { checkMyThing } from './my-check'

// diagnostics/index.ts - add to PRE_GENERATION_CHECKS array
import { checkMyThing } from './checks'

export const PRE_GENERATION_CHECKS: PreGenerationCheck[] = [
  // ... existing checks ...
  {
    id: 'check-my-thing',
    run: checkMyThing,
  },
]
```

### 3. Add tests

```typescript
// diagnostics/__tests__/checks.test.ts (add to existing file)
describe('checkMyThing', () => {
  it('detects the issue', () => {
    const ctx = buildPreGenerationContext({
      graphs: [/* graph with the issue */],
    })
    const collector = new DiagnosticsCollector()
    checkMyThing(ctx, collector)
    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('check-my-thing')
  })

  it('passes for valid graphs', () => {
    const ctx = buildPreGenerationContext({
      graphs: [/* valid graph */],
    })
    const collector = new DiagnosticsCollector()
    checkMyThing(ctx, collector)
    expect(collector.hasErrors()).toBe(false)
  })
})
```

## Check Patterns and Best Practices

### 1. Use the precomputed context

```typescript
// GOOD: Use precomputed maps
const graph = ctx.graphsById.get(graphId)
const nodes = ctx.nodesByGraph.get(graphId)

// BAD: Iterate all graphs to find one
const graph = ctx.graphs.find(g => g.id === graphId)
```

### 2. Include actionable source information

```typescript
// GOOD: Full source for UI navigation
collector.addError({
  id: 'my-check',
  category: 'config',
  message: 'Option name is empty',
  source: {
    graphId: graph.id,
    graphName: graph.name,
    nodeId: node.id,
    nodeType: node.data.nodeType,
  },
  suggestions: ['Set a valid option name in the node properties'],
})

// BAD: No source, user can't find the issue
collector.addError({
  id: 'my-check',
  category: 'config',
  message: 'Something is wrong',
})
```

### 3. Prefer warnings over errors for non-blocking issues

- **Error:** Generation cannot produce valid Lua (missing required input, cycles)
- **Warning:** Generation will work but result may be unexpected (orphaned nodes, unused callables)

### 4. Check for disabled graphs

Many checks should skip disabled graphs:

```typescript
for (const graph of ctx.graphs) {
  const state = ctx.disableStates.get(graph.id)
  if (state?.effective.kind !== 'enabled') continue
  // ... check enabled graphs only
}
```

## UI Integration

The `DiagnosticList` component (`components/DiagnosticList.tsx`) displays diagnostics:
- Sorts errors before warnings
- Shows collapsible items with details and suggestions
- "Go to graph" button for navigable diagnostics (those with `graphId` and `nodeId`)
- Navigation uses `useNavigationIntentStore` to set intent, then routes to `/editor`

A diagnostic is "navigable" when `isNavigable(diagnostic)` returns true (has `source.graphId`).

## Related Documentation

- [Architecture](./architecture.md) -- How diagnostics fit in Phase 3
- [Node Generators](./node-generators.md) -- Runtime diagnostics from generators
- [Testing](./testing.md) -- Testing diagnostic checks
