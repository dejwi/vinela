# Testing

> Test patterns, utilities, and best practices for the lua-generator.
> Test utilities in `src/features/lua-generator/__tests__/`.

## Overview

The lua-generator has **52 test files** covering all modules. Tests use Vitest with a combination of unit tests, integration tests, and snapshot tests.

For end-to-end generated `init.lua` validation, staged Neovim startup checks, and startup artifact triage, see `docs/generated-config-testing.md`.

### Test File Locations

```
src/features/lua-generator/
|-- __tests__/
|   |-- index.ts                              # Test barrel exports
|   |-- infrastructure-verification.test.ts   # Smoke tests
|   |-- utils/
|   |   |-- graph-builder.ts                  # Fluent graph construction
|   |   |-- lua-validator.ts                  # Lua syntax validation
|   |   |-- snapshot.ts                       # Snapshot normalization
|   |   |-- temp-project.ts                   # Temp project creation
|   |-- fixtures/
|       |-- graphs/                           # Pre-built graph fixtures
|       |   |-- simple-startup.ts
|       |   |-- conditional.ts
|       |   |-- callable.ts
|       |   |-- loop-types.ts
|       |   |-- all-nodes.ts
|       |-- projects/                         # Pre-built project fixtures
|           |-- minimal.ts
|           |-- complex.ts
|
|-- generators/nodes/__tests__/               # Node generator tests
|   |-- register.test.ts
|   |-- callable-entry.test.ts
|   |-- return.test.ts
|   |-- control/condition.test.ts
|   |-- control/loop.test.ts
|   |-- advanced/code-block.test.ts
|   |-- advanced/graph-ref.test.ts
|   |-- builtin/check-feature.test.ts
|   |-- builtin/check-platform.test.ts
|   |-- builtin/get-variable.test.ts
|   |-- builtin/require-module.test.ts
|
|-- generators/nodes/action/__tests__/        # Action generator tests
|   |-- set-option.test.ts
|   |-- set-keymap.test.ts
|   |-- set-variable.test.ts
|   |-- run-command.test.ts
|   |-- create-autocmd.test.ts
|   |-- set-highlight.test.ts
|   |-- get-variable.test.ts
|   |-- call-function.test.ts
|
|-- traversal/__tests__/                      # Traversal tests
|   |-- indexes.test.ts
|   |-- exec-traversal.test.ts
|   |-- data-dependencies.test.ts
|   |-- cycle-detection.test.ts
|   |-- integration.test.ts
|
|-- orchestrator/__tests__/                   # Orchestrator tests
|   |-- assemble.test.ts
|   |-- graph-generation.test.ts
|   |-- phase-coordinator.test.ts
|   |-- full-pipeline.test.ts
|
|-- sections/__tests__/                       # Section tests
|   |-- leader-key-section.test.ts
|   |-- neovim-options-section.test.ts
|   |-- plugin-section.test.ts
|   |-- lsp-section.test.ts
|   |-- colorscheme-section.test.ts
|   |-- highlight-section.test.ts
|   |-- project-keymaps-section.test.ts
|
|-- diagnostics/__tests__/                    # Diagnostic tests
|   |-- collector.test.ts
|   |-- checks.test.ts
|
|-- deploy/__tests__/                         # Deploy tests
|   |-- deploy.test.ts
|   |-- export.test.ts
|   |-- path-resolution.test.ts
|
|-- utils/__tests__/                          # Utility tests
|   |-- lua-builder.test.ts
|   |-- lua-serialize.test.ts
|   |-- lua-string.test.ts
|   |-- lua-utils.test.ts
|   |-- indent.test.ts
|   |-- config-merge.test.ts
|
|-- hooks/__tests__/useLuaPreview.test.ts     # Hook tests
|-- stores/__tests__/generation-store.test.ts # Store tests
|-- components/__tests__/                     # Component tests
```

## Test Utilities

### Callable-key assertions

Callable registry key expectations must derive from `formatCallableId` instead of hard-coded `_G._vinela_callables["..."]` literals.

- Helpers: `src/features/lua-generator/__tests__/utils/callable-keys.ts`
  - `expectedCallableRef(name, id)`
  - `expectedAutocmdCallbackRef(graphName, nodeId)`
- Matchers: `src/features/lua-generator/__tests__/utils/lua-matchers.ts`
  - `toContainCallableRegistration(name, id)`
  - `toContainCallableInvocation(name, id)`
  - `toContainAutocmdCallbackRegistration(graphName, nodeId)`

Guardrail: `bun run pretest` runs `scripts/check-test-literals.ts` and fails if non-allowlisted lua-generator tests contain hard-coded callable table key literals.

When the callable format changes, update only `formatCallableId` contract tests and the canonical full-pipeline pin, then run `bun run test -- -u` once if snapshots changed.

### GraphBuilder

**File:** `__tests__/utils/graph-builder.ts` (413 lines)

Fluent DSL for building test graphs. This is the most important test utility.

```typescript
import { GraphBuilder, createCallablePort } from '@/features/lua-generator/__tests__'

// constructor(name: string, id?: string)
// First arg is the human-readable name; second optional arg is the graph ID
const graph = new GraphBuilder('My Graph', 'graph-1')
  .startupTrigger('trigger-1')
  .action('action-1', 'set-option', {
    optionName: 'number',
    scope: 'global',
    valueConfig: { type: 'boolean', value: true },
  })
  .connectExec('trigger-1', 'action-1')
  .build()
```

#### Node Creation Methods

```typescript
// Triggers
builder.startupTrigger(id, displayName?)

// Callable graphs
builder.callableEntry(id, parameters?, name?)
builder.returnNode(id, returnValues?, name?)

// Actions
builder.action(id, actionType, config, name?)

// Control flow
builder.condition(id, operator, a, b, name?)
builder.loop(id, loopType, varName, expression, name?)

// Advanced
builder.codeBlock(id, code, inputs?, outputs?)
builder.graphRef(id, referencedGraphId, name?)
builder.runFunction(id, functionKey, source, name?)
builder.builtin(id, builtinId, config?, name?)
```

#### Connection Methods

```typescript
// Generic connection — uses explicit defaults 'out' (source) and 'in' (target)
// when ports are omitted. Not auto-detected; pass explicit ports for real graph edges.
builder.connect(sourceId, targetId, sourcePort?, targetPort?)

// Explicit data connection
builder.connectData(sourceId, sourcePort, targetId, targetPort)

// Exec connections (auto-detects source exec port)
builder.connectExec(sourceId, targetId)

// Condition branches
builder.connectTrue(conditionId, targetId)
builder.connectFalse(conditionId, targetId)

// Loop connections
builder.connectLoopBody(loopId, targetId)
builder.connectLoopComplete(loopId, targetId)
```

#### Graph Metadata

```typescript
builder.withDescription(desc)
builder.withEnabled(enabled)
builder.withOrder(order)
builder.withViewport(viewport)
```

#### Example: Complex Graph

```typescript
const graph = new GraphBuilder('Complex', 'g1')
  .startupTrigger('t1')
  .condition('c1', '==', 'true', 'true')
  .action('a1', 'set-option', { optionName: 'number', scope: 'global', valueConfig: { type: 'boolean', value: true } })
  .action('a2', 'run-command', { action: 'echo "hello"', actionType: 'command' })
  .action('a3', 'set-option', { optionName: 'wrap', scope: 'global', valueConfig: { type: 'boolean', value: false } })
  .connectExec('t1', 'c1')
  .connectTrue('c1', 'a1')
  .connectFalse('c1', 'a2')
  .connectExec('a1', 'a3')  // Merge point after condition
  .connectExec('a2', 'a3')
  .build()
```

### Lua Validator

**File:** `__tests__/utils/lua-validator.ts` (201 lines)

Validates generated Lua syntax using external tools:

```typescript
import { validateLuaSyntax, probeLuaValidationTools } from '@/features/lua-generator/__tests__'

// Check available tools
const tools = await probeLuaValidationTools()
// { hasLuac: true, hasNeovim: false, reasonIfMissing: [] }

// Validate Lua code
const result = await validateLuaSyntax('vim.opt.number = true')
// { valid: true, engine: 'luac' }

const result2 = await validateLuaSyntax('if true')
// { valid: false, engine: 'luac', error: '...', line: 1 }
```

**Tool preference (Neovim target runtime):** `nvim --headless` (closest oracle) > `luajit -b` > `luac5.1 -p` > `lua5.1 loadfile` > compatible `luac` (Lua 5.1 only). `luac5.4` / Lua 5.4 is **not** sufficient for release validation.

Checker selection is **capability-based**, not version-only. A candidate must pass the exact compile/load-only validation invocation (`nvim --headless ... -l`, `luajit -b`, `luac -p`, or `lua5.1` + `loadfile` validator) against a harmless no-op before it is selected. Capability probes use a **short bounded deadline** (2 seconds) so automatic fallback finishes inside Vitest's default test/hook timeouts; a probe that cannot prove capability within that bound is recorded as a typed `timeout` rejection and discovery continues. Per-assertion syntax checks keep a separate 10-second safety budget for large generated fixtures. On Ubuntu 22.04, packaged Neovim 0.6.1 often hangs or fails the `-l` probe and the detector intentionally falls through to installed LuaJIT.

`VINELA_LUA_SYNTAX_CHECKER` is an **authoritative, fail-closed override** for supported basenames only (`nvim`, `luajit`, `luac5.1`, `lua5.1`, `luac`). Invalid, missing, incompatible, or capability-failing overrides return unavailable diagnostics and do **not** silently fall back to other PATH tools. Default PATH probing does fall through in order until a capable checker is found.

Both successful and unavailable `probeLuaSyntaxTool()` results expose ordered `searchedCommands` and typed `rejectedCommands` (identity and capability stages). Lua 5.4 binaries may appear only as diagnostic rejections (`luac5.4` / incompatible bare `luac`); they are never selected as the release oracle.

Syntax validation is mandatory in CI and local development. Tests fail (they do not skip) when no Neovim-compatible checker is available. Install `nvim`, `luajit`, `luac5.1`, or `lua5.1`, or set `VINELA_LUA_SYNTAX_CHECKER` to one of those supported commands. Raising Vitest timeouts, filtering the suite, or accepting hook-failure skips are **not** substitutes for checker remediation.

Internal CI installs LuaJIT and runs the complete `bun run test` step with `VINELA_LUA_SYNTAX_CHECKER=luajit`, making the full suite the deterministic release oracle for both application regressions and real generated-syntax validation. Generic automatic discovery, old-Neovim fallback, subprocess timeout classification, and forceful cleanup remain covered by `lua-assert.detector.test.ts` and `lua-syntax-command-runner.test.ts`.

### Snapshot Utility

**File:** `__tests__/utils/snapshot.ts` (121 lines)

Normalizes Lua code for stable snapshot comparisons:

```typescript
import { normalizeLuaForSnapshot, createStableSnapshot } from '@/features/lua-generator/__tests__'

// Remove timestamps, UUIDs, normalize whitespace
const normalized = createStableSnapshot(generatedLua)
expect(normalized).toMatchSnapshot()

// Custom normalization
const custom = normalizeLuaForSnapshot(generatedLua, {
  removeLinePatterns: [/--\s*Generated.*/],
  normalizeIndentation: true,
  tabWidth: 2,
})
```

### Temp Project

**File:** `__tests__/utils/temp-project.ts` (191 lines)

Creates isolated temporary projects for integration tests:

```typescript
import { createTempProject, createEmptyFixture } from '@/features/lua-generator/__tests__'

// Create minimal fixture
const fixture = createEmptyFixture('Test Project')
fixture.graphs = [myGraph]
fixture.plugins = [{ id: 'treesitter', schemaId: 'treesitter', enabled: true, config: {} }]

// Create temp project (uses memory storage)
const { projectPath, projectId, cleanup } = await createTempProject(fixture)

try {
  // Run tests against projectPath
  const result = await generateInitLua({ projectPath })
} finally {
  await cleanup()
}
```

### Pre-built Fixtures

#### Graph Fixtures

```typescript
import {
  simpleStartupGraph,      // Trigger -> Set Option
  simpleSetOptionGraph,     // Trigger -> Set Option (number)
  conditionalGraph,         // Trigger -> Condition -> true/false branches
  nestedConditionalGraph,   // Nested if/else
  callableGraph,            // Callable Entry -> actions -> Return
  multiParamCallableGraph,  // Multiple parameters
  forLoopGraph,             // Numeric for loop
  whileLoopGraph,           // While loop
  eachLoopGraph,            // For-each loop
  allNodesGraph,            // One of every node type
} from '@/features/lua-generator/__tests__'
```

#### Project Fixtures

```typescript
import {
  minimalProject,   // Bare minimum project
  complexProject,   // Full project with plugins, keymaps, options
} from '@/features/lua-generator/__tests__'
```

## Testing Patterns

### Pattern 1: Testing Node Generators

Node generators are pure functions -- easy to test in isolation:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { myGenerator } from '../my-generator'

function createMockContext(overrides?: Partial<GenerationContext>): GenerationContext {
  return {
    graphId: 'test-graph',
    graphName: 'Test',
    nodeById: new Map(),
    edges: [],
    indexes: {
      nodesByGraph: new Map(),
      edgesByGraph: new Map(),
      execEdges: new Map(),
      dataEdges: new Map(),
    },
    inputBindings: {},
    outputBindingHints: {},
    indentLevel: 0,
    renderExecFromPort: vi.fn().mockReturnValue([]),
    sanitizeIdentifier: (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral: (v: unknown) => String(v),
    emitDiagnostic: vi.fn(),
    callableSymbolByGraphId: new Map(),
    getVariableName: (hint?: string) => `_gen_${hint ?? 'var'}_1`,
    ...overrides,
  }
}

describe('myGenerator', () => {
  it('generates correct code', () => {
    const node = { /* ... */ }
    const ctx = createMockContext()
    const result = myGenerator.generate(node, ctx)

    expect(result.code).toEqual([
      'vim.opt.number = true',
    ])
    expect(result.nodeType).toBe('action')
  })

  it('uses connected input over config', () => {
    const node = { /* ... */ }
    const ctx = createMockContext({
      inputBindings: { value: '_ns_upstream_value' },
    })
    const result = myGenerator.generate(node, ctx)

    expect(result.code[0]).toContain('_ns_upstream_value')
  })

  it('emits diagnostic for invalid config', () => {
    const emitDiagnostic = vi.fn()
    const node = { /* invalid config */ }
    const ctx = createMockContext({ emitDiagnostic })

    myGenerator.generate(node, ctx)

    expect(emitDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        id: expect.stringContaining('INVALID'),
      })
    )
  })

  it('handles renderExecFromPort for downstream code', () => {
    const renderExecFromPort = vi.fn().mockReturnValue([
      'vim.opt.wrap = false',
    ])
    const node = { /* trigger node */ }
    const ctx = createMockContext({ renderExecFromPort })

    const result = myGenerator.generate(node, ctx)

    expect(renderExecFromPort).toHaveBeenCalledWith(node.id, 'exec')
    expect(result.code).toContain('vim.opt.wrap = false')
  })
})
```

### Pattern 2: Testing Traversal

Use `GraphBuilder` to create test graphs, then run traversal:

```typescript
import { describe, expect, it } from 'vitest'
import { GraphBuilder } from '@/features/lua-generator/__tests__'
import { buildGraphIndexes } from '@/features/lua-generator/traversal/indexes'
import { traverseExecFlow } from '@/features/lua-generator/traversal/exec-traversal'
import { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'

describe('exec traversal', () => {
  it('traverses linear flow', () => {
    const graph = new GraphBuilder('Test', 'g1')
      .startupTrigger('t1')
      .action('a1', 'set-option', { /* ... */ })
      .action('a2', 'set-option', { /* ... */ })
      .connectExec('t1', 'a1')
      .connectExec('a1', 'a2')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = indexes.byGraph.get('g1')!
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow('t1', indexed, {
      currentGraphId: 'g1',
      graphName: 'Test',
      enableNodeGeneration: true,
      indentLevel: 0,
      variableCounter: 0,
      graphContracts: new Map(),
    }, collector)

    expect(units).toHaveLength(1)  // Trigger unit (others inlined)
    expect(collector.hasErrors()).toBe(false)
  })
})
```

### Pattern 3: Testing Sections

Section generators are pure functions with simple inputs:

```typescript
import { describe, expect, it } from 'vitest'
import { generatePluginSection } from '../plugin-section'

describe('generatePluginSection', () => {
  it('generates plugin declarations and setup for the built-in treesitter contract', () => {
    const result = generatePluginSection({
      resolvedPlugins: [{
        plugin: { id: 'treesitter', schemaId: 'nvim-treesitter', enabled: true, config: {} },
        schema: {
          id: 'nvim-treesitter',
          pluginName: 'nvim-treesitter',
          pluginRepo: 'https://github.com/nvim-treesitter/nvim-treesitter',
          pack: { version: { mode: 'ref', value: 'main' } },
          setup: {
            requirePath: 'nvim-treesitter',
            render: {
              kind: 'lua-template',
              template:
                "local config = {{config}}\nif config.highlight and config.highlight.enable then\n  vim.api.nvim_create_autocmd('FileType', { callback = function(args) pcall(vim.treesitter.start, args.buf, 'lua') end })",
            },
          },
          options: [],
        },
      }],
      themePluginIds: new Set(),
    })

    expect(result.id).toBe('plugins')
    const code = result.code.join('\n')
    expect(code).toContain('version = "main"')
    expect(code).toContain("nvim_create_autocmd('FileType'")
    expect(code).toContain('vim.treesitter.start')
    expect(code).not.toContain('nvim-treesitter.configs')
    expect(code).not.toContain('require("nvim-treesitter")')
    expect(code).not.toContain("treesitter.get_installed('parsers')")
  })

  it('returns empty for no plugins', () => {
    const result = generatePluginSection({
      resolvedPlugins: [],
      themePluginIds: new Set(),
    })
    expect(result.code).toHaveLength(0)
  })
})
```

### Pattern 4: Testing Diagnostics

```typescript
import { describe, expect, it } from 'vitest'
import { DiagnosticsCollector } from '../collector'
import { checkEmptyGraphs } from '../checks'
import { buildPreGenerationContext } from '../index'
import { GraphBuilder } from '@/features/lua-generator/__tests__'

describe('checkEmptyGraphs', () => {
  it('warns about empty graphs', () => {
    const graph = new GraphBuilder('Empty', 'g1').build()  // No nodes
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkEmptyGraphs(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()[0]?.message).toContain('Empty')
  })
})
```

### Pattern 5: Full Pipeline Tests

For end-to-end tests, mock storage modules:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock all storage modules
vi.mock('@/features/graph-editor/storage', () => ({
  listGraphs: vi.fn(),
}))
vi.mock('@/features/plugins/storage', () => ({
  loadInstalledPlugins: vi.fn(),
}))
// ... more mocks

describe('full pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates init.lua from project data', async () => {
    // Setup mocks
    const { listGraphs } = await import('@/features/graph-editor/storage')
    ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue([myGraph])

    // Run generation
    const result = await generateInitLua({ projectPath: '/test' })

    expect(result.success).toBe(true)
    expect(result.initLua).toContain('vim.opt.number = true')
  })
})
```

### Pattern 6: Store Tests

Test selectors with mock state:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { selectCanDeploy, selectIsOperationInProgress } from '../store'

function createBaseState(overrides?: Partial<GenerationState>): GenerationState {
  return {
    dialogOpen: false,
    dialogPhase: { type: 'pre-flight' },
    lastResult: null,
    lastGeneratedAt: null,
    lastDeployResult: null,
    lastDeployedAt: null,
    activeAbortController: null,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    generate: vi.fn(),
    cancelGeneration: vi.fn(),
    deploy: vi.fn(),
    resetForProjectClose: vi.fn(),
    ...overrides,
  }
}

describe('selectCanDeploy', () => {
  it('returns true when generation succeeded', () => {
    const state = createBaseState({
      lastResult: { success: true, initLua: 'code', diagnostics: [], metadata: { /* ... */ } },
    })
    expect(selectCanDeploy(state)).toBe(true)
  })
})
```

## Running Tests

```bash
# Run all lua-generator tests
bun test src/features/lua-generator/

# Run specific test file
bun test src/features/lua-generator/generators/nodes/__tests__/callable-entry.test.ts

# Run with coverage
bun test --coverage src/features/lua-generator/

# Run in watch mode
bun test --watch src/features/lua-generator/
```

## Test Coverage Summary

| Module | Test Files | Approximate Cases |
|--------|-----------|-------------------|
| Node generators | 16 files | ~150 cases |
| Traversal | 5 files | ~60 cases |
| Sections | 7 files | ~90 cases |
| Diagnostics | 2 files | ~60 cases |
| Orchestrator | 4 files | ~40 cases |
| Deploy | 3 files | ~34 cases |
| Utils | 6 files | ~80 cases |
| Store/Hooks/Components | 3+ files | ~30 cases |

## Related Documentation

- [Node Generators](./node-generators.md) -- What to test in generators
- [Traversal](./traversal.md) -- What to test in traversal
- [Diagnostics](./diagnostics.md) -- What to test in checks
