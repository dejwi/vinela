# Node Generators

> How to understand, modify, and add new node generators in `src/features/lua-generator/generators/nodes/`.

## Overview

Node generators are the core of Lua code generation. Each node type in the visual graph editor has a corresponding generator that converts it into Lua code. Generators are registered in a central registry and dispatched during graph traversal.

## Generator Interface

Every generator implements the `NodeGenerator<T>` interface:

```typescript
// src/features/lua-generator/generators/nodes/types.ts

interface NodeGenerator<T extends NodeData> {
  generate(node: GraphNode<T>, context: GenerationContext): CompilationUnit
}
```

A generator receives:
1. **`node`** -- The graph node with its typed data
2. **`context`** -- Everything needed to generate code (see below)

And returns a `CompilationUnit` with the generated Lua code.

## GenerationContext API

### Callable identifier format

Callable table keys are emitted via `formatCallableId(name, id)` in `src/features/lua-generator/lua-utils.ts` and consumed across callable-entry, graph-ref, autocmd callback indirection, and keymap custom actions. Treat this utility as the single source of truth for key shape.

The `GenerationContext` is the primary interface between the traversal system and node generators. It's constructed in `exec-traversal.ts` and passed to each generator.

```typescript
interface GenerationContext {
  // === Graph Information ===
  readonly graphId: string                              // Current graph ID
  readonly graphName: string                            // Current graph name
  readonly nodeById: ReadonlyMap<string, GraphNode>     // All nodes in graph
  readonly edges: readonly GraphEdge[]                  // All edges in graph
  readonly indexes: GraphIndexes                        // Precomputed indexes

  // === Input Resolution ===
  readonly inputBindings: Readonly<Record<string, string>>
  // Maps input port ID -> Lua expression (variable name or literal)
  // Populated by data dependency resolution before generator is called

  readonly getInputValue?: (portId: string) => string
  // Alternative input lookup (less commonly used)

  // === Output Hints ===
  readonly outputBindingHints: Readonly<Record<string, string>>
  // Maps output port ID -> suggested variable name
  // Generator can use these or provide its own in CompilationUnit.outputBindings

  // === Code Generation Helpers ===
  readonly indentLevel: number
  // Current nesting depth (0 = top level)

  readonly renderExecFromPort: (nodeId: string, sourcePortId: string) => string[]
  // CRITICAL: Generates code for nodes connected to an exec output port
  // Used by condition, loop, trigger, autocmd generators to embed branch/body code
  // Returns lines at indent level 0 -- the caller's LuaBuilder handles indentation

  readonly sanitizeIdentifier: (raw: string) => string
  // Converts arbitrary string to valid Lua identifier

  readonly toLuaLiteral: (value: unknown) => string
  // Converts JS value to Lua literal (string, number, boolean, table, nil)

  readonly getVariableName: (hint?: string) => string
  // Generates unique variable name: _gen_{hint}_{counter}

  // === Diagnostics ===
  readonly emitDiagnostic: (diagnostic: GenerationDiagnostic) => void
  // Report errors/warnings without throwing

  // === Cross-Graph References ===
  readonly callableSymbolByGraphId: ReadonlyMap<string, string>
  // Maps graph ID -> callable symbol (for graph-ref nodes)

  readonly callableContracts?: ReadonlyMap<string, CallableContract>
  // Maps graph ID -> parameter/return contract (for graph-ref nodes)
}
```

### How `inputBindings` Works

Before a generator is called, the traversal system resolves all incoming data edges:

```
[Set Option Node] --value--> [Target Node]
     ^                            ^
     |                            |
  sourcePortId="value"      targetPortId="value"
```

The traversal resolves this to:
```typescript
inputBindings = {
  "value": "_ns_abc123_value"  // Variable name from upstream node's output
}
```

The generator reads it:
```typescript
const valueExpr = context.inputBindings['value'] ?? '"default"'
// Use valueExpr in generated Lua code
```

### How `renderExecFromPort` Works

This is the most important context method. It generates code for downstream nodes connected to an execution port:

```typescript
// In condition generator:
const trueLines = context.renderExecFromPort(node.id, 'true')
const falseLines = context.renderExecFromPort(node.id, 'false')

builder.block('if condition then', (inner) => {
  for (const line of trueLines) {
    inner.line(line)  // Lines come at indent 0, builder adds indentation
  }
}, 'end')
```

**Critical detail:** `renderExecFromPort` returns lines at indent level 0. The calling generator's `LuaBuilder.block()` / `inner.line()` handles proper indentation. This prevents double-indenting.

**Side effect:** Nodes traversed via `renderExecFromPort` are marked as "emitted" and won't be processed again by the outer traversal loop.

## Port Handling

### Exec vs Data Ports

Ports are classified by the indexer (`traversal/indexes.ts`):

| Node Type | Exec Output Ports | Data Output Ports |
|-----------|-------------------|-------------------|
| `trigger` | `exec` | (none) |
| `callable-entry` | `exec` | (none -- params are output bindings) |
| `action` | `done`, `on-event` | varies by action type |
| `condition` | `true`, `false` | (none) |
| `loop` | `loop`, `done` | `item`, `index` |
| `code-block` | `done` | user-defined outputs |
| `graph-ref` | `done` | per return value |
| `builtin` | `done` | per output |
| `return` | (none) | (none -- terminal) |

### Input Resolution Helpers

Use the shared input resolver (`generators/nodes/shared/input-resolver.ts`):

```typescript
import { resolveInput, resolveInputOptional, resolveInputRequired } from './shared/input-resolver'

// Returns discriminated union: { kind: 'bound', expression } | { kind: 'fallback', expression } | { kind: 'missing' }
const result = resolveInput(context, 'value', '"default"')

// Returns expression string, empty string if missing
const expr = resolveInputOptional(context, 'value', '"default"')

// Returns expression or null (emits diagnostic if missing)
const expr = resolveInputRequired(context, node.id, 'action', 'value', 'Value input is required')
```

## Existing Generators Reference

### Trigger Generators

#### `on-startup` (`trigger/on-startup.ts`)
- **Handles:** `trigger:startup`, `trigger:on-startup`
- **Generates:** `do ... end` block wrapping downstream code
- **Key pattern:** Uses `renderExecFromPort(node.id, 'exec')` for body

### Control Flow Generators

#### `condition` (`control/condition.ts`)
- **Handles:** `condition`
- **Input ports:** `a`, `b` (operands)
- **Exec ports:** `true`, `false` (branches)
- **Generates:** `if a op b then ... else ... end`
- **Key pattern:** Uses `renderExecFromPort` for both branches, finds merge point

#### `loop` (`control/loop.ts`)
- **Handles:** `loop`
- **Exec ports:** `loop` (body), `done` (completion)
- **Data ports:** `item`, `index` (for each loops)
- **Generates:** `for`/`while`/`for...in` blocks
- **Key pattern:** Uses `renderExecFromPort(node.id, 'loop')` for body

### Action Generators

#### `set-option` (`action/set-option.ts`)
- **Generates:** `vim.opt.name = value` or `vim.opt_local.name = value`
- **Input port:** `value` (optional override)

#### `set-keymap` (`action/set-keymap.ts`)
- **Generates:** `vim.keymap.set(mode, key, rhs, opts)`
- **Input ports:** `key-sequence`, `on-press` (optional overrides)
- **Special:** Detects function syntax, converts arrow functions to Lua

#### `set-variable` (`action/set-variable.ts`)
- **Generates:** `vim.g.name = value` (or `vim.b`, `vim.w`, etc.)
- **Input port:** `value` (optional override)

#### `run-command` (`action/run-command.ts`)
- **Generates:** `vim.cmd("command")` or `nvim_feedkeys()`
- **No data ports** -- purely execution

#### `create-autocmd` (`action/create-autocmd.ts`, 476 lines -- largest generator)
- **Generates:** `nvim_create_autocmd(event, { callback = ... })`
- **Exec port:** `on-event` (callback body)
- **Special:** Detects simple vs complex callbacks, inlines when possible

#### `set-highlight` (`action/set-highlight.ts`)
- **Generates:** `nvim_set_hl()` with merge semantics
- **No data ports** -- configuration only
- **Special:** Reads existing highlight before setting (preserves unset attributes)

#### `call-function` (`action/call-function.ts`)
- **Generates:** `func(args)` or `vim.fn.func(args)`
- **Output binding:** `done` only — the generator does **not** expose a data output port for the return value; the call result is not captured into a variable

### Advanced Generators

#### `graph-ref` (`advanced/graph-ref.ts`)
- **Generates:** `_G._vinela_callables["<graph_name>_<shortid>"]({ params })`
- **Input ports:** One per target graph's parameters
- **Output ports:** One per target graph's return values
- **Key pattern:** Uses `callableContracts` to know parameter/return shapes

#### `code-block` (`advanced/code-block.ts`, 297 lines)
- **Generates:** Wrapped user code as local function
- **Input/output ports:** User-defined
- **Special:** Validates block balance, checks for return statements, warns about reserved words

#### `callable-entry` (`callable-entry.ts`)
- **Generates:** `_G._vinela_callables["<graph_name>_<shortid>"] = function(params) ... end`
- **Key pattern:** Materializes parameters as local variables, uses `renderExecFromPort` for body

#### `return` (`return.ts`)
- **Generates:** `return { ["key"] = value, ... }`
- **Input ports:** One per return value
- **Terminal node** -- no exec output

#### `run-function` (`run-function.ts`)
- **Registry key:** `run-function`
- **Purpose:** Calls an arbitrary core or plugin Lua function defined by a `luaCall` template captured at node-creation time
- **Input ports:** One per signature parameter — `param:<name>` (e.g., `param:cwd`, `param:opts`); connected values override per-param defaults stored in `paramDefaults`
- **Exec ports:** `done` (continuation)
- **Data output ports:** `result` — only present when the function's `returns` field is not `'void'`; holds the local variable capturing the call's return value
- **Generates:**
  ```lua
  -- Void return (result discarded):
  vim.lsp.buf.hover()

  -- Non-void return (result captured):
  local _gen_result_1 = require('telescope.builtin').find_files({ cwd = "/home" })
  ```
- **Special behavior:**
  - The `luaCall` field is a template string (e.g., `"vim.fn.expand($path)"`) validated against the declared `params` list via `validateTemplate()` before rendering
  - `renderTemplate()` substitutes each `$<name>` placeholder with the connected input expression or the param default (supports `scalar`, `lua`, `multiselect`, and `object` default variants)
  - Dotted param defaults (for example `layout.preset`) are grouped into nested tables before emission (`layout = { preset = ... }`)
  - For functions that expose an `opts` catch-all param, structured defaults + `opts` are merged as `vim.tbl_extend("force", structured, opts)`; structured fields are authoritative.
  - Emits `'run-function-missing-signature'` error and skips generation if `signature` is `null`
  - Emits `'run-function-missing-required-param'` error for each non-optional parameter with no connection and no default
  - Emits `'run-function-invalid-template'` or `'run-function-render-failed'` on template failures
  - `done` is always registered in `outputBindings` (as `'nil'`) so exec traversal can follow the continuation edge

### Builtin Generators

#### `require-module` (`builtin/require-module.ts`)
- **Generates:** `local mod = require('name')` or just `require('name')`

#### `check-feature` (`builtin/check-feature.ts`)
- **Generates:** `local has = vim.fn.has('feature') == 1`

#### `check-platform` (`builtin/check-platform.ts`)
- **Generates:** `local is = vim.fn.has('platform') == 1`

#### `get-variable` (`builtin/get-variable.ts`)
- **Generates:** `local val = vim.g.name`

#### `ui.notify` (`builtin/ui-notify.ts`)
- **Registry key:** `builtin:ui.notify`
- **Purpose:** Shows a Neovim notification via `vim.notify()`
- **Config fields:**
  - `message` (string, default `'Configuration updated'`) — notification text
  - `level` (`'info' | 'warn' | 'error' | 'debug' | 'trace'`, default `'info'`) — log level constant
  - `title` (string, optional) — notification title shown by notify plugins
- **Input ports:** `message` (string), `title` (string) — connected values override config
- **Exec ports:** `done` (continuation)
- **Generates:**
  ```lua
  -- Without title:
  vim.notify("Configuration updated", vim.log.levels.INFO)
  -- With title (config or connected input):
  vim.notify("msg", vim.log.levels.WARN, { title = "My Title" })
  ```
- **Special:** Level strings (`'warn'`, `'error'`, etc.) are mapped to `vim.log.levels.*` constants; `title` is omitted entirely when blank

#### `buffers.open-file` (`builtin/open-file.ts`)
- **Registry key:** `builtin:buffers.open-file`
- **Purpose:** Opens a file in Neovim using a `vim.cmd()` call, with shell-safe path escaping
- **Config fields:**
  - `path` (string, required) — file path to open
  - `mode` (`'edit' | 'split' | 'vsplit' | 'tabedit'`, default `'edit'`) — how to open the file
- **Input ports:** `path` (string) — connected value overrides config path
- **Exec ports:** `done` (continuation)
- **Generates:**
  ```lua
  -- Literal path from config:
  vim.cmd('edit ' .. vim.fn.fnameescape("/path/to/file"))
  -- Dynamic path from connected input:
  vim.cmd('vsplit ' .. vim.fn.fnameescape(path_var))
  ```
- **Special:** Emits a `warning` diagnostic when path is empty and no input is connected; `vim.fn.fnameescape()` ensures safe handling of spaces and special characters; invalid mode strings are silently clamped to `'edit'`

#### `automation.delay` (`builtin/delay.ts`)
- **Registry key:** `builtin:automation.delay`
- **Purpose:** Wraps all downstream execution inside a `vim.defer_fn()` callback so it runs after a configurable delay
- **Config fields:**
  - `delayMs` (number, default `100`, minimum `0`) — delay in milliseconds
- **Input ports:** (none)
- **Exec ports:** `done` — **all downstream code is placed inside the deferred callback**, not after it
- **Generates:**
  ```lua
  vim.defer_fn(function()
    -- downstream code runs here, after the delay
    vim.opt.number = true
  end, 100)
  ```
- **Special:** This is a **wrapping node** — unlike other action nodes that emit their line and then chain continuation, the delay generator calls `renderExecFromPort(nodeId, 'done')` itself and embeds downstream lines inside the callback body. Negative `delayMs` emits a warning and is clamped to `0`; a `0ms` delay also emits a warning (defers to next event loop tick, valid but unusual).

#### `input.prompt` (`builtin/prompt.ts`)
- **Registry key:** `builtin:input.prompt`
- **Purpose:** Prompts the user for text input via `vim.fn.input()` and exposes the result as a data output
- **Config fields:**
  - `prompt` (string, default `'Input: '`) — prompt text displayed to the user
  - `defaultValue` (string, default `''`) — pre-filled default; omitted from generated call when empty
- **Input ports:** (none)
- **Exec ports:** `done` (continuation)
- **Data output ports:** `value` (string) — the variable holding the user's input, usable by downstream data edges
- **Generates:**
  ```lua
  -- Without default value:
  local _gen_value_1 = vim.fn.input("Input: ")
  -- With default value:
  local _gen_value_1 = vim.fn.input("Search: ", "default text")
  ```
- **Special:** The generated variable name uses `context.getVariableName('value')` for uniqueness. The `value` output binding is registered in `outputBindings` so downstream nodes can reference it via data edges. Prompt and default strings are double-quoted with backslash escaping applied.

## LuaBuilder API

Most generators use `LuaBuilder` for code construction:

```typescript
import { LuaBuilder } from '@/features/lua-generator/utils/lua-builder'

const builder = new LuaBuilder()

// Simple lines
builder.line('vim.opt.number = true')
builder.comment('This is a comment')
builder.blank()

// Blocks with automatic indent/dedent
builder.block('if condition then', (inner) => {
  inner.line('print("yes")')
  inner.block('for i = 1, 10 do', (loop) => {
    loop.line('print(i)')
  }, 'end')
}, 'end')

// Manual indent control
builder.indent()
builder.line('indented line')
builder.dedent()

// Build final string
const lua = builder.build()
```

**Important:** `build()` throws `LuaBuilderError` with code `UNCLOSED_BLOCK` if indent level is not 0 (when `strictIndentBalance` is true, which is the default).

## Generator Registration

Generators are registered in `register.ts` with multiple aliases for backward compatibility:

```typescript
// Primary registration (used by resolveGeneratorType)
registerGenerator('action:set-option', { generate: generateSetOption })

// Aliases (for legacy node data formats)
registerGenerator('setOption', { generate: generateSetOption })
```

The `resolveGeneratorType()` function maps node data to registry keys:

```typescript
function resolveGeneratorType(node: GraphNode): string {
  switch (node.data.nodeType) {
    case 'trigger':  return `trigger:${node.data.triggerType}`
    case 'action':   return `action:${node.data.actionType}`
    case 'builtin':  return `builtin:${node.data.builtinId}`
    default:         return node.data.nodeType
  }
}
```

## Template: Adding a New Generator

### 1. Create the generator file

```typescript
// src/features/lua-generator/generators/nodes/action/my-action.ts

import type { GraphNode } from '@/shared/types'
import type { MyActionConfig } from '@/shared/types/graph'
import { LuaBuilder } from '@/features/lua-generator/utils/lua-builder'
import { resolveInputOptional } from '../shared/input-resolver'
import { createUnit, type GenerationContext, type NodeGenerator, type CompilationUnit } from '../types'

interface MyActionNodeData {
  nodeType: 'action'
  actionType: 'my-action'
  config: MyActionConfig
}

export const myActionGenerator: NodeGenerator<MyActionNodeData> = {
  generate(node: GraphNode<MyActionNodeData>, context: GenerationContext): CompilationUnit {
    const config = node.data.config
    const builder = new LuaBuilder()

    // 1. Resolve inputs (connected data ports override config values)
    const valueExpr = resolveInputOptional(context, 'value', context.toLuaLiteral(config.defaultValue))

    // 2. Validate config
    if (!config.name) {
      context.emitDiagnostic({
        id: 'INVALID_CONFIG',
        severity: 'error',
        category: 'config',
        message: 'Name is required for my-action',
        source: { graphId: context.graphId, nodeId: node.id, nodeType: 'action' },
      })
      return createUnit(node.id, 'action', [], context.indentLevel)
    }

    // 3. Generate Lua code
    builder.line(`vim.my_api("${config.name}", ${valueExpr})`)

    // 4. Handle exec continuation (if this node has downstream exec)
    const continuationLines = context.renderExecFromPort(node.id, 'done')
    for (const line of continuationLines) {
      builder.line(line)
    }

    // 5. Return compilation unit
    return createUnit(node.id, 'action', builder.build().split('\n').filter(Boolean), context.indentLevel)
  },
}
```

### 2. Register the generator

```typescript
// In register.ts, add:
import { myActionGenerator } from './action/my-action'

// In initializeGenerators():
registerGenerator('action:my-action', myActionGenerator)
registerGenerator('myAction', myActionGenerator)  // Legacy alias
```

### 3. Add tests

```typescript
// src/features/lua-generator/generators/nodes/action/__tests__/my-action.test.ts

import { describe, expect, it, vi } from 'vitest'
import { myActionGenerator } from '../my-action'
import type { GenerationContext } from '../../types'

function createMockContext(overrides?: Partial<GenerationContext>): GenerationContext {
  return {
    graphId: 'test-graph',
    graphName: 'Test Graph',
    nodeById: new Map(),
    edges: [],
    indexes: { nodesByGraph: new Map(), edgesByGraph: new Map(), execEdges: new Map(), dataEdges: new Map() },
    inputBindings: {},
    outputBindingHints: {},
    indentLevel: 0,
    renderExecFromPort: () => [],
    sanitizeIdentifier: (s) => s.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral: (v) => JSON.stringify(v),
    emitDiagnostic: vi.fn(),
    callableSymbolByGraphId: new Map(),
    getVariableName: (hint) => `_gen_${hint ?? 'var'}_1`,
    ...overrides,
  }
}

describe('myActionGenerator', () => {
  it('generates correct Lua for basic config', () => {
    const node = {
      id: 'node-1',
      type: 'action',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'action' as const,
        actionType: 'my-action' as const,
        config: { name: 'test', defaultValue: 42 },
      },
    }

    const result = myActionGenerator.generate(node, createMockContext())
    expect(result.code).toContain('vim.my_api("test", 42)')
  })

  it('emits diagnostic for missing name', () => {
    const emitDiagnostic = vi.fn()
    const node = { /* ... node with empty name ... */ }

    myActionGenerator.generate(node, createMockContext({ emitDiagnostic }))
    expect(emitDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'INVALID_CONFIG' })
    )
  })
})
```

## Shared Utilities

### `shared/input-resolver.ts`
- `resolveInput(ctx, portId, fallback?)` -- Returns `InputResolutionResult` discriminated union
- `resolveInputOptional(ctx, portId, fallback?)` -- Returns expression string
- `resolveInputRequired(ctx, nodeId, nodeType, portId, description)` -- Returns expression or null + diagnostic

### `shared/lua-literal.ts`
- `toLuaLiteral(value)` -- JS -> Lua literal
- `toLuaString(str)` -- String with escaping
- `toLuaBracketKey(key)` -- `["key"]` notation

### `shared/lua-emit.ts`
- `emitCall(builder, func, args)` -- Function call
- `emitAssignment(builder, target, value)` -- Assignment
- `emitTable(builder, entries)` -- Table literal
- `emitIfBlock(builder, condition, body)` -- If block
- `emitForNumericBlock(builder, var, start, stop, step, body)` -- Numeric for
- `emitFunctionDef(builder, name, params, body)` -- Function definition

### `shared/output-vars.ts`
- `generateOutputVarName(nodeId, hint)` -- `_nvimset_{nodeId}_{hint}`
- `generateParamVarName(portId)` -- `param_{sanitized}`
- `generateReturnVarName(portId)` -- `ret_{sanitized}`

### `shared/diagnostics.ts`
- Standard diagnostic codes: `INVALID_CONFIG`, `MISSING_INPUT`, `UNSUPPORTED_LEGACY`, etc.
- `createNodeDiagnostic()` -- Factory for standardized diagnostics

## Related Documentation

- [Architecture](./architecture.md) -- How generators fit in the pipeline
- [Traversal](./traversal.md) -- How `inputBindings` and `renderExecFromPort` are constructed
- [Testing](./testing.md) -- Testing patterns for generators
- [Common Issues](./common-issues.md) -- Port ID mismatches and other gotchas
