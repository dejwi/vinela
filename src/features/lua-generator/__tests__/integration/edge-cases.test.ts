/**
 * Category 10: Edge Cases and Diagnostics
 *
 * Tests verifying the pipeline degrades gracefully on invalid or unusual graph
 * states, diagnostics are precise, and generation never hangs or crashes.
 *
 * Test split:
 *   - 10.1–10.10, 10.14–10.15  → graph-level / pre-generation checks (this file)
 *   - 10.11–10.13               → orchestrator layer (full-pipeline.test.ts)
 *
 * Every case that produces Lua output calls assertLuaSyntaxValid() (Category 12
 * cross-cutting requirement).
 */

import { beforeAll, describe, expect, it } from 'vitest'
import {
  createCallablePort,
  GraphBuilder,
} from '@/features/lua-generator/__tests__/utils/graph-builder'
import {
  buildPreGenerationContext,
  runAllPreGenerationChecks,
} from '@/features/lua-generator/diagnostics/index'
import type { GenerationDiagnostic } from '@/features/lua-generator/diagnostics/types'
import { createDefaultActionConfig } from '@/shared/types'
import {
  generateLuaFromGraph,
  generateLuaFromGraphs,
} from './helpers/generate-lua'
import {
  assertBlocksBalanced,
  assertLuaSyntaxValid,
  ensureLuaParserAvailable,
} from './helpers/lua-assertions'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await ensureLuaParserAvailable()
})

// ─────────────────────────────────────────────────────────────────────────────
// Local assertion helpers
// ─────────────────────────────────────────────────────────────────────────────

function expectDiagnosticId(
  diagnostics: readonly GenerationDiagnostic[],
  id: string,
): void {
  const ids = diagnostics.map((d) => d.id)
  expect(
    ids,
    `Expected diagnostic ID "${id}" but got: ${JSON.stringify(ids)}`,
  ).toContain(id)
}

function expectNoDiagnosticId(
  diagnostics: readonly GenerationDiagnostic[],
  id: string,
): void {
  const ids = diagnostics.map((d) => d.id)
  expect(
    ids,
    `Expected diagnostic ID "${id}" to be absent but it was present`,
  ).not.toContain(id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Category 10: Edge Cases and Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

describe('Category 10: Edge Cases and Diagnostics', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 10.1 Empty graph (no nodes)
  // ───────────────────────────────────────────────────────────────────────────

  it('10.1 empty graph emits WARN_EMPTY_GRAPH_NO_NODES and produces valid header-only Lua', async () => {
    const graph = new GraphBuilder('Empty', 'g-empty').build()

    // Pre-generation check should flag it
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const { collector } = runAllPreGenerationChecks(ctx)
    expectDiagnosticId(collector.getAll(), 'WARN_EMPTY_GRAPH_NO_NODES')

    // Direct generation must not throw; output should still be valid Lua
    const { lua, diagnostics } = generateLuaFromGraphs([graph])
    expect(diagnostics.hasErrors()).toBe(false)

    // Header-only output is a valid Lua file (no nodes → no executable content)
    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.2 Graph with isolated nodes (trigger + 3 orphaned actions)
  // ───────────────────────────────────────────────────────────────────────────

  it('10.2 isolated (orphaned) action nodes emit WARN_STRUCTURE_ORPHANED_NODE and generation completes', async () => {
    const graph = new GraphBuilder('Isolated', 'g-isolated')
      .startupTrigger('trigger')
      .action('orphan1', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .action('orphan2', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'wrap',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: false },
      })
      .action('orphan3', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'relativenumber',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      // No edges — trigger and all actions are disconnected
      .build()

    // Pre-generation check must flag orphaned nodes
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const { collector } = runAllPreGenerationChecks(ctx)
    expectDiagnosticId(collector.getAll(), 'WARN_STRUCTURE_ORPHANED_NODE')

    // Direct generation must complete without crashing
    const { lua, diagnostics } = generateLuaFromGraph(graph)
    expect(diagnostics.hasErrors()).toBe(false)

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.3 Graph with only non-entry nodes (no trigger / callable-entry)
  // ───────────────────────────────────────────────────────────────────────────

  it('10.3 graph with no entry nodes emits WARN_EMPTY_GRAPH_NO_ENTRY and pipeline completes', () => {
    const graph = new GraphBuilder('NoEntry', 'g-no-entry')
      .action('a1', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .action('a2', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'wrap',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: false },
      })
      .action('a3', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'relativenumber',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('a1', 'a2')
      .connectExec('a2', 'a3')
      .build()

    // Pre-generation check must flag missing entry
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const { collector } = runAllPreGenerationChecks(ctx)
    expectDiagnosticId(collector.getAll(), 'WARN_EMPTY_GRAPH_NO_ENTRY')

    // Direct generation completes — no startup/callable units, no crash
    const { startupUnits, callableUnits, diagnostics } = generateLuaFromGraphs([
      graph,
    ])
    expect(diagnostics.hasErrors()).toBe(false)
    expect(startupUnits).toHaveLength(0)
    expect(callableUnits).toHaveLength(0)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.4 Duplicate node IDs across different graphs (not an error)
  // ───────────────────────────────────────────────────────────────────────────

  it('10.4 same node ID in different graphs does not produce ERR_DUPLICATE_NODE_ID and generation succeeds', () => {
    const graphA = new GraphBuilder('GraphA', 'g-dup-a')
      .startupTrigger('shared-trigger')
      .action('action1', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('shared-trigger', 'action1')
      .build()

    const graphB = new GraphBuilder('GraphB', 'g-dup-b')
      .startupTrigger('shared-trigger') // Same node ID — different graph
      .action('action1', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'wrap',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: false },
      })
      .connectExec('shared-trigger', 'action1')
      .build()

    const ctx = buildPreGenerationContext({ graphs: [graphA, graphB] })
    const { collector } = runAllPreGenerationChecks(ctx)

    // Cross-graph duplicate node IDs are NOT an error
    expectNoDiagnosticId(collector.getAll(), 'ERR_DUPLICATE_NODE_ID')

    // Generation must succeed for both graphs
    const { diagnostics, startupUnits } = generateLuaFromGraphs([
      graphA,
      graphB,
    ])
    expect(diagnostics.hasErrors()).toBe(false)
    expect(startupUnits).toHaveLength(2)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.5 Exec cycle detection: Startup → A → B → A
  // ───────────────────────────────────────────────────────────────────────────

  it('10.5 exec cycle emits ERR_CYCLE_INTRA_GRAPH and does not hang', () => {
    const graph = new GraphBuilder('ExecCycle', 'g-exec-cycle')
      .startupTrigger('trigger')
      .action('nodeA', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo A',
        selectedActionKey: '',
        paramValues: {},
      })
      .action('nodeB', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo B',
        selectedActionKey: '',
        paramValues: {},
      })
      // trigger → A → B → A (cycle)
      .connectExec('trigger', 'nodeA')
      .connect('nodeA', 'nodeB', 'done', 'exec')
      .connect('nodeB', 'nodeA', 'done', 'exec') // back-edge creating cycle
      .build()

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const { collector } = runAllPreGenerationChecks(ctx)

    expectDiagnosticId(collector.getAll(), 'ERR_CYCLE_INTRA_GRAPH')
    // Verify it finished (no hang)
    expect(collector.getAll().length).toBeGreaterThan(0)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.6 Data cycle detection: A.out→B.in, B.out→A.in with exec path
  // ───────────────────────────────────────────────────────────────────────────

  it('10.6 data cycle emits ERR_CYCLE_INTRA_GRAPH and terminates without crash', () => {
    const graph = new GraphBuilder('DataCycle', 'g-data-cycle')
      .startupTrigger('trigger')
      .codeBlock(
        'nodeA',
        'local x = input_val\nreturn x + 1',
        [{ id: 'input_val', name: 'input_val', dataType: 'number' }],
        [{ id: 'result', name: 'result', dataType: 'number' }],
      )
      .codeBlock(
        'nodeB',
        'local y = feed\nreturn y * 2',
        [{ id: 'feed', name: 'feed', dataType: 'number' }],
        [{ id: 'out', name: 'out', dataType: 'number' }],
      )
      // Exec path so traversal reaches A
      .connectExec('trigger', 'nodeA')
      .connectExec('nodeA', 'nodeB')
      // Reciprocal data edges: A.result→B.feed and B.out→A.input_val
      .connectData('nodeA', 'result', 'nodeB', 'feed')
      .connectData('nodeB', 'out', 'nodeA', 'input_val')
      .build()

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const { collector } = runAllPreGenerationChecks(ctx)

    expectDiagnosticId(collector.getAll(), 'ERR_CYCLE_INTRA_GRAPH')
    // Terminates with a diagnostic result — no infinite loop
    expect(collector.getAll().length).toBeGreaterThan(0)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.7 Invalid action config — empty option name
  // ───────────────────────────────────────────────────────────────────────────

  it('10.7 set-option with empty optionName emits ERR_CONFIG_EMPTY_OPTION_NAME', () => {
    const graph = new GraphBuilder('EmptyOption', 'g-empty-option')
      .startupTrigger('trigger')
      .action('badOpt', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: '', // intentionally empty
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('trigger', 'badOpt')
      .build()

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const { collector } = runAllPreGenerationChecks(ctx)

    expectDiagnosticId(collector.getAll(), 'ERR_CONFIG_EMPTY_OPTION_NAME')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.8 Graph-ref to disabled graph (pre-gen context layer)
  // Note: Orchestrator-level WARN_GRAPH_DISABLED/BLOCKED is tested in
  // full-pipeline.test.ts (10.11–10.12). Here we verify the disable-state
  // context is computed correctly so the caller is transitively blocked.
  // ───────────────────────────────────────────────────────────────────────────

  it('10.8 caller of a user-disabled callable graph is transitively dependency-disabled in the pre-gen context', () => {
    const callableGraph = new GraphBuilder('Helper', 'g-helper-disabled')
      .callableEntry('ce', [createCallablePort('x', 'X', 'number')])
      .action('act', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo helper',
        selectedActionKey: '',
        paramValues: {},
      })
      .connectExec('ce', 'act')
      .withEnabled(false) // user-disabled
      .build()

    const callerGraph = new GraphBuilder('Caller', 'g-caller')
      .startupTrigger('trigger')
      .graphRef('ref1', 'g-helper-disabled')
      .connectExec('trigger', 'ref1')
      .build()

    const ctx = buildPreGenerationContext({
      graphs: [callableGraph, callerGraph],
    })

    // The disabled callable must be user-disabled in the context
    const helperState = ctx.disableStates.get('g-helper-disabled')
    expect(helperState?.effective.kind).toBe('user-disabled')

    // The caller references a disabled graph, so it should be
    // transitively dependency-disabled
    const callerState = ctx.disableStates.get('g-caller')
    expect(callerState?.effective.kind).toBe('dependency-disabled')

    // Pre-generation checks will skip both graphs (both non-enabled)
    // and emit no diagnostics — the orchestrator handles WARN_GRAPH_BLOCKED
    const { collector } = runAllPreGenerationChecks(ctx)
    expect(collector.hasErrors()).toBe(false)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.9 Very large graph (50+ nodes)
  // ───────────────────────────────────────────────────────────────────────────

  it('10.9 50-node chain completes without errors in under 2 seconds and produces valid syntax', async () => {
    const CHAIN_LENGTH = 50

    const builder = new GraphBuilder(
      'LargeChain',
      'g-large-chain',
    ).startupTrigger('trigger')

    // Add 50 run-action nodes with explicit valid configs
    for (let i = 1; i <= CHAIN_LENGTH; i++) {
      builder.action(`node${i}`, 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: `echo "step${i}"`,
        selectedActionKey: '',
        paramValues: {},
      })
    }

    // Connect trigger → node1 → node2 → … → node50
    builder.connectExec('trigger', 'node1')
    for (let i = 1; i < CHAIN_LENGTH; i++) {
      builder.connect(`node${i}`, `node${i + 1}`, 'done', 'exec')
    }

    const graph = builder.build()

    // Pre-generation checks must pass cleanly
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const { collector: preCollector } = runAllPreGenerationChecks(ctx)
    expect(preCollector.hasErrors()).toBe(false)

    // Generation must complete within a reasonable time
    const start = performance.now()
    const { lua, diagnostics } = generateLuaFromGraph(graph)
    const elapsed = performance.now() - start

    expect(diagnostics.hasErrors()).toBe(false)
    expect(elapsed).toBeLessThan(2000)

    // First and last steps must be present
    expect(lua).toContain('step1')
    expect(lua).toContain(`step${CHAIN_LENGTH}`)

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.10 All node types mixed in a single graph
  // ───────────────────────────────────────────────────────────────────────────

  it('10.10 graph with all node types mixed completes without fatal errors', async () => {
    // Callable target for graph-ref
    const callableTarget = new GraphBuilder('Target', 'g-mixed-target')
      .callableEntry('ce', [createCallablePort('val', 'Val', 'string')])
      .action('targetAct', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo target',
        selectedActionKey: '',
        paramValues: {},
      })
      .connectExec('ce', 'targetAct')
      .build()

    // Main graph mixing all supported node types
    const mainGraph = new GraphBuilder('AllTypes', 'g-all-types')
      .startupTrigger('trigger')
      // condition
      .condition('cond', '>', 'x', '0')
      // loop
      .loop('for1', 'for', 'i', '1, 3')
      // code-block (inline code, no ports — avoids missing-return warning)
      .codeBlock('code1', 'local msg = "hello"')
      // builtin
      .builtin('notify1', 'ui.notify', { message: 'started', level: 'info' })
      // graph-ref to the callable target
      .graphRef('ref1', 'g-mixed-target')
      // run-function with a real signature snapshot and a param default to avoid
      // "missing required parameter" errors
      .runFunctionWithSignature(
        'fn1',
        'vim.fn.expand',
        { type: 'core', functionName: 'vim.fn.expand' },
        {
          params: [{ name: 'expr', type: 'string' }],
          returns: 'string',
          luaCall: 'vim.fn.expand($params)',
        },
        { expr: { kind: 'scalar', value: '%:p' } },
      )
      // action (set-option)
      .action('optAct', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      // Wire exec flow
      .connectExec('trigger', 'cond')
      .connectTrue('cond', 'for1')
      .connectLoopBody('for1', 'code1')
      .connectLoopComplete('for1', 'notify1')
      .connectExec('notify1', 'ref1')
      .connectExec('ref1', 'fn1')
      .connectExec('fn1', 'optAct')
      .build()

    // Should not crash — warnings are acceptable, fatal errors are not
    const { lua, diagnostics } = generateLuaFromGraphs([
      callableTarget,
      mainGraph,
    ])
    expect(diagnostics.hasErrors()).toBe(false)

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.14 Code block with unbalanced block keywords
  // ───────────────────────────────────────────────────────────────────────────

  it('10.14 code block with "if true then" emits WARN_CONFIG_CODEBLOCK_MISMATCHED_KEYWORDS and generation completes', async () => {
    const graph = new GraphBuilder('UnbalancedBlock', 'g-unbalanced')
      .startupTrigger('trigger')
      .codeBlock('unbal', 'if true then') // unbalanced: missing 'end'
      .connectExec('trigger', 'unbal')
      .build()

    // Pre-generation must flag the mismatched keywords
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const { collector } = runAllPreGenerationChecks(ctx)
    expectDiagnosticId(
      collector.getAll(),
      'WARN_CONFIG_CODEBLOCK_MISMATCHED_KEYWORDS',
    )

    // Direct generation must still complete (warnings, not fatal errors)
    const { lua, diagnostics } = generateLuaFromGraph(graph)
    expect(diagnostics.hasErrors()).toBe(false)

    // The assembler wraps graph output in functions so the file itself is valid
    // even though the code-block content is malformed; assert the outer file.
    // (We do NOT call assertLuaSyntaxValid here because the generated Lua will
    // contain the unbalanced user code which is intentionally invalid Lua.)
    expect(lua).toBeDefined()
    expect(lua.length).toBeGreaterThan(0)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10.15 Code block with "return 42" and no outputs
  // ───────────────────────────────────────────────────────────────────────────

  it('10.15 code block with "return 42" and no outputs produces no error and generates successfully', async () => {
    const graph = new GraphBuilder('ReturnNoOutputs', 'g-return-no-outputs')
      .startupTrigger('trigger')
      // No output ports declared — return value is silently discarded
      .codeBlock('retBlock', 'return 42')
      .connectExec('trigger', 'retBlock')
      .build()

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const { collector } = runAllPreGenerationChecks(ctx)

    // No error expected — return without outputs is valid
    expect(collector.hasErrors()).toBe(false)
    // Should not emit a missing-return warning either (no outputs defined)
    expectNoDiagnosticId(
      collector.getAll(),
      'WARN_CONFIG_CODEBLOCK_MISSING_RETURN',
    )

    // Generation must succeed
    const { lua, diagnostics } = generateLuaFromGraph(graph)
    expect(diagnostics.hasErrors()).toBe(false)

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })
})
