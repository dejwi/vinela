/**
 * Category 14: Regression Tests
 *
 * Specific tests for bugs that have been found and fixed, to prevent
 * regression. Each test is self-contained and documents the exact scenario
 * that previously failed.
 *
 * Bugs covered:
 * - Port ID mismatches between the UI layer and the graph indexer (14.1–14.6)
 * - Double emission of nodes connected inside branches/loops (14.7–14.8)
 * - Merge-point detection across autocmd callback paths (14.9–14.11)
 */

/**
 * ═══════════════════════════════════════════════════════════════════════
 * BUG REPRODUCTION GUIDE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * To verify these regression tests actually catch their bugs, you can
 * temporarily revert the fix and confirm the test fails. Instructions
 * for each bug family:
 *
 * ── Port Classification Bugs (14.1-14.6) ──────────────────────────────
 *
 * File: src/features/lua-generator/traversal/indexes.ts
 * Function: isExecEdge()
 *
 * To reproduce 14.1: Change line `return portId === 'exec'` under
 *   case 'trigger' to `return false`
 *   Expected: 14.1 fails (no vim.opt.number in output)
 *   Minimum assertion that catches it: `expect(lua).toContain('vim.opt.number')`
 *   Stronger assertion: exec edge count on trigger node === 1
 *
 * To reproduce 14.2: Change line `return portId === 'exec'` under
 *   case 'callable-entry' to `return false`
 *   Expected: 14.2 fails (callable unit code is empty)
 *
 * To reproduce 14.3: Remove `portId === 'done'` from case 'action'
 *   Expected: 14.3 fails (second action missing from output)
 *
 * To reproduce 14.4: Remove `portId === 'on-event'` from case 'action'
 *   Expected: 14.4 fails (callback body missing from autocmd)
 *
 * To reproduce 14.5: Remove `portId === 'loop'` from case 'loop'
 *   Expected: 14.5 fails (loop body empty)
 *
 * To reproduce 14.6: Change case 'code-block' to always return false
 *   Expected: 14.6 fails (successor action missing)
 *
 * ── Double Emission Bugs (14.7-14.8) ──────────────────────────────────
 *
 * File: src/features/lua-generator/traversal/exec-traversal.ts
 * Function: generateInlineCode() + traverse()
 *
 * To reproduce 14.7/14.8: In generateInlineCode(), remove the line
 *   `emittedNodeIds.add(nodeId)` (line ~166)
 *   Expected: 14.7 fails (branch code appears twice)
 *   Expected: 14.8 fails (loop body code appears twice)
 *   Minimum assertion: occurrence count === 1
 *
 * ── Merge Point / Callback Bugs (14.9-14.11) ──────────────────────────
 *
 * File: src/features/lua-generator/traversal/exec-traversal.ts
 *
 * To reproduce 14.9 (rewritten): In getAllReachableContinuations(),
 *   remove the callback port exclusion (change `!callbackPorts.has(...)` to `true`)
 *   Expected: 14.9 fails (merge node emitted in wrong scope or duplicated)
 *
 * To reproduce 14.10: Remove the CALLBACK_EXEC_PORTS entry for
 *   'action:create-autocmd' (line ~639)
 *   Expected: 14.10 fails (ambiguous-exec-continuation warning appears)
 *   Expected: 14.11 fails (main flow inside callback)
 *
 * To reproduce 14.11: Same as 14.10 — the CALLBACK_EXEC_PORTS registry
 *   is the fix for both bugs.
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'vitest'
import { requireIndexedGraph } from '@/features/lua-generator/__tests__/utils/graph-index-assertions'
import { requireFirst } from '@/features/lua-generator/__tests__/utils/test-assertions'
import type { Graph } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import { buildGraphIndexes } from '../../traversal/indexes'
import { generateLuaFromGraphs } from '../utils/generate-helper'
import { createCallablePort, GraphBuilder } from '../utils/graph-builder'
import { assertBlocksBalanced, assertLuaSyntaxValid } from '../utils/lua-assert'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set-option (number = true) action config, reused across tests */
const setNumberTrue = {
  ...createDefaultActionConfig('set-option'),
  optionName: 'number',
  scope: 'global' as const,
  valueConfig: { valueMode: 'suggested' as const, suggestedValue: true },
}

/** Set-option (wrap = false) action config */
const setWrapFalse = {
  ...createDefaultActionConfig('set-option'),
  optionName: 'wrap',
  scope: 'global' as const,
  valueConfig: { valueMode: 'suggested' as const, suggestedValue: false },
}

/** run-action (echo i) action config */
function runCommand(cmd: string) {
  return {
    ...createDefaultActionConfig('run-action'),
    mode: 'custom-command' as const,
    actionType: 'command' as const,
    action: cmd,
    selectedActionKey: '',
    paramValues: {},
  }
}

/** Default create-autocmd config for tests */
const defaultAutocmdConfig = (events: string[], patterns: string[]) => ({
  ...createDefaultActionConfig('create-autocmd'),
  events,
  patterns,
  callbackLua: '',
  groupName: '',
  once: false,
  nested: false,
})

// ---------------------------------------------------------------------------
// Position assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that `needle` appears after `anchor` in `lua`, with clear failure
 * messages. Factors out the repeated indexOf + toBeGreaterThan pattern.
 */
function assertAppearsAfter(lua: string, needle: string, anchor: string): void {
  const anchorIdx = lua.indexOf(anchor)
  const needleIdx = lua.indexOf(needle)
  expect(
    anchorIdx,
    `anchor "${anchor}" must be present in output`,
  ).toBeGreaterThanOrEqual(0)
  expect(
    needleIdx,
    `needle "${needle}" must be present in output`,
  ).toBeGreaterThanOrEqual(0)
  expect(
    needleIdx,
    `"${needle}" must appear after "${anchor}"`,
  ).toBeGreaterThan(anchorIdx)
}

/**
 * Assert that `needle` falls between `blockOpen` and the next `blockClose`
 * after it. Use for "X must appear inside block Y" checks.
 */
function assertAppearsInside(
  lua: string,
  needle: string,
  blockOpen: string,
  blockClose: string,
): void {
  const openIdx = lua.indexOf(blockOpen)
  const closeIdx = lua.indexOf(blockClose, openIdx + 1)
  const needleIdx = lua.indexOf(needle, openIdx)
  expect(
    openIdx,
    `block open "${blockOpen}" must be present`,
  ).toBeGreaterThanOrEqual(0)
  expect(
    closeIdx,
    `block close "${blockClose}" must appear after open`,
  ).toBeGreaterThan(openIdx)
  expect(
    needleIdx,
    `"${needle}" must appear inside "${blockOpen}"..."${blockClose}"`,
  ).toBeGreaterThan(openIdx)
  expect(
    needleIdx,
    `"${needle}" must appear before block close "${blockClose}"`,
  ).toBeLessThan(closeIdx)
}

// ---------------------------------------------------------------------------
// Category 14: Regression Tests
// ---------------------------------------------------------------------------

describe('Category 14: Regression Tests', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // 14.1 Port ID mismatch: trigger exec port
  // ─────────────────────────────────────────────────────────────────────────
  it('14.1 trigger exec port is classified as EXEC (not data)', () => {
    // BEFORE FIX: The trigger's 'exec' port was not matched in isExecEdge(),
    // so the edge was classified as a DataEdge. Result: no code generated.
    // Buggy output was header-only:
    //   -- Generated by vinela
    //   -- Project: Test Project
    //   (no vim.opt.number = true)

    const graph = new GraphBuilder('Startup-14.1', 'startup-14-1')
      .startupTrigger('trigger')
      .action('setOpt', 'set-option', setNumberTrue)
      .connectExec('trigger', 'setOpt') // uses sourcePort='exec', targetPort='exec'
      .build()

    // Direct port classification check
    const indexed = buildGraphIndexes([graph])
    const graphIdx = requireIndexedGraph(indexed, graph.id)
    const triggerExecEdges = graphIdx.outgoingExecByNode.get('trigger') ?? []
    const triggerDataEdges = graphIdx.outgoingDataByNode.get('trigger') ?? []
    expect(triggerExecEdges).toHaveLength(1)
    expect(
      requireFirst(triggerExecEdges, 'trigger exec edges').sourcePortId,
    ).toBe('exec')
    expect(triggerDataEdges).toHaveLength(0) // No data edges from trigger

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    // Exactly one occurrence of the set-option code
    const matches = lua.match(/vim\.opt\.number = true/g)
    expect(matches).toHaveLength(1)

    // No errors about missing execution flow
    const errors = diagnostics.getErrors()
    const triggerFlowError = errors.find(
      (e) =>
        e.message.toLowerCase().includes('trigger') &&
        e.message.toLowerCase().includes('no connected execution flow'),
    )
    expect(triggerFlowError).toBeUndefined()

    // Should NOT have any unreachable-node warnings
    expect(
      diagnostics.getWarnings().filter((w) => w.id === 'unreachable-node'),
    ).toHaveLength(0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 14.2 Port ID mismatch: callable-entry exec port
  // ─────────────────────────────────────────────────────────────────────────
  it('14.2 callable-entry exec port is classified as EXEC', () => {
    // BEFORE FIX: callable-entry's 'exec' port was not in isExecEdge(),
    // so the edge to setOpt was classified as data. The callable function
    // body was empty:
    //   callable table registration for callable-14-2
    //   end
    //   (no vim.opt.number = true inside)

    const graph = new GraphBuilder('Callable-14.2', 'callable-14-2')
      .callableEntry('entry')
      .action('setOpt', 'set-option', setNumberTrue)
      .returnNode('ret')
      .connectExec('entry', 'setOpt')
      .connectExec('setOpt', 'ret')
      .build()

    // Direct port classification check
    const indexed = buildGraphIndexes([graph])
    const graphIdx = requireIndexedGraph(indexed, graph.id)
    const entryExecEdges = graphIdx.outgoingExecByNode.get('entry') ?? []
    const entryDataEdges = graphIdx.outgoingDataByNode.get('entry') ?? []
    expect(entryExecEdges).toHaveLength(1)
    expect(requireFirst(entryExecEdges, 'entry exec edges').sourcePortId).toBe(
      'exec',
    )
    expect(entryDataEdges).toHaveLength(0)

    const { callableUnits, diagnostics } = generateLuaFromGraphs([graph])

    // No generation errors
    expect(diagnostics.hasErrors()).toBe(false)

    // A callable graph compiles to a single unit keyed by the entry node.
    // The action body is inlined inside the generated function.
    expect(callableUnits).toHaveLength(1)
    const entryUnit = callableUnits[0]
    expect(entryUnit).toBeDefined()
    // The set-option code must be present inside the callable function body
    const unitCode = entryUnit?.code.join('\n') ?? ''
    expect(unitCode).toContain('vim.opt.number = true')

    // Callable unit code must not be empty
    expect(unitCode.trim().length).toBeGreaterThan(0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 14.3 Port ID mismatch: action done port
  // ─────────────────────────────────────────────────────────────────────────
  it('14.3 action done port is classified as EXEC, enabling chained actions', () => {
    // BEFORE FIX: action's 'done' port was not matched in isExecEdge(),
    // so the edge from first.done -> second.exec was classified as data.
    // Only the first action appeared in output:
    //   vim.opt.number = true
    //   (missing: vim.opt.wrap = false)

    const graph = new GraphBuilder('Chain-14.3', 'chain-14-3')
      .startupTrigger('trigger')
      .action('first', 'set-option', setNumberTrue)
      .action('second', 'set-option', setWrapFalse)
      .connectExec('trigger', 'first')
      .connectExec('first', 'second') // edge: first.done -> second.exec
      .build()

    // Direct port classification check
    const indexed = buildGraphIndexes([graph])
    const graphIdx = requireIndexedGraph(indexed, graph.id)
    const firstExecEdges = graphIdx.outgoingExecByNode.get('first') ?? []
    const firstDataEdges = graphIdx.outgoingDataByNode.get('first') ?? []
    expect(firstExecEdges).toHaveLength(1)
    expect(requireFirst(firstExecEdges, 'first exec edges').sourcePortId).toBe(
      'done',
    )
    expect(firstDataEdges).toHaveLength(0)

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    // Both must appear exactly once, in order
    const numberIdx = lua.indexOf('vim.opt.number = true')
    const wrapIdx = lua.indexOf('vim.opt.wrap = false')
    expect(numberIdx).toBeGreaterThanOrEqual(0)
    expect(wrapIdx).toBeGreaterThan(numberIdx) // second action after first
    expect(lua.match(/vim\.opt\.number = true/g)).toHaveLength(1)
    expect(lua.match(/vim\.opt\.wrap = false/g)).toHaveLength(1)

    // No errors
    expect(diagnostics.hasErrors()).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 14.4 Port ID mismatch: create-autocmd on-event port
  // ─────────────────────────────────────────────────────────────────────────
  it('14.4 create-autocmd on-event port is classified as EXEC', () => {
    // BEFORE FIX: 'on-event' was not in isExecEdge() for action nodes,
    // so the callback edge was classified as data. The autocmd was registered
    // but with an empty callback:
    //   vim.api.nvim_create_autocmd({ "BufEnter" }, {
    //     pattern = { "*" },
    //     callback = function()
    //     end,
    //   })
    //   (missing: vim.opt.number = true inside callback)

    const graph = new GraphBuilder('Autocmd-14.4', 'autocmd-14-4')
      .startupTrigger('trigger')
      .action(
        'autocmd',
        'create-autocmd',
        defaultAutocmdConfig(['BufEnter'], ['*']),
      )
      .action('callback', 'set-option', setNumberTrue)
      .connectExec('trigger', 'autocmd')
      .connect('autocmd', 'callback', 'on-event', 'exec') // explicit on-event connection
      .build()

    // Direct port classification check
    const indexed = buildGraphIndexes([graph])
    const graphIdx = requireIndexedGraph(indexed, graph.id)
    const autocmdExecEdges = graphIdx.outgoingExecByNode.get('autocmd') ?? []
    expect(autocmdExecEdges).toHaveLength(1)
    expect(
      requireFirst(autocmdExecEdges, 'autocmd exec edges').sourcePortId,
    ).toBe('on-event')
    expect(
      requireFirst(autocmdExecEdges, 'autocmd exec edges').targetNodeId,
    ).toBe('callback')

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    // The autocmd registration must be present
    expect(lua).toContain('nvim_create_autocmd')
    expect(lua).toContain('BufEnter')

    // The callback body (set-option) must appear inside the autocmd callback.
    // The emitter inlines simple single-action callbacks, so it appears on the
    // same line or before the autocmd call closes.
    expect(lua).toContain('vim.opt.number = true')

    // Only 1 occurrence total (not also emitted standalone after autocmd)
    expect(lua.match(/vim\.opt\.number = true/g)).toHaveLength(1)

    // Callback code must appear before or within the autocmd call, not as a
    // standalone statement after it. Use nvim_create_autocmd as the boundary.
    const autocmdLineIdx = lua.indexOf('nvim_create_autocmd')
    const setOptIdx = lua.indexOf('vim.opt.number = true')
    const autocmdLineEnd =
      autocmdLineIdx + lua.slice(autocmdLineIdx).indexOf('\n')
    // set-opt must appear at or before the end of the autocmd line (inline callback)
    expect(setOptIdx).toBeLessThanOrEqual(autocmdLineEnd)

    // No critical errors about missing callbacks
    const callbackErrors = diagnostics
      .getErrors()
      .filter((e) => e.id === 'ERR_AUTOCMD_NO_CALLBACK')
    expect(callbackErrors).toHaveLength(0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 14.5 Port ID mismatch: loop body port
  // ─────────────────────────────────────────────────────────────────────────
  it('14.5 loop body port (loop) is classified as EXEC', () => {
    // BEFORE FIX: 'loop' port was not in isExecEdge() for loop nodes,
    // so the body edge was classified as data. The loop was emitted empty:
    //   for i = 1, 3 do
    //   end
    //   (missing: vim.cmd('echo i') inside loop body)

    const graph = new GraphBuilder('Loop-14.5', 'loop-14-5')
      .startupTrigger('trigger')
      .loop('for1', 'for', 'i', '1, 3')
      .action('body', 'run-action', runCommand('echo i'))
      .connectExec('trigger', 'for1')
      .connectLoopBody('for1', 'body') // port: 'loop'
      .build()

    // Direct port classification check
    const indexed = buildGraphIndexes([graph])
    const graphIdx = requireIndexedGraph(indexed, graph.id)
    const loopExecEdges = graphIdx.outgoingExecByNode.get('for1') ?? []
    expect(loopExecEdges).toHaveLength(1)
    expect(requireFirst(loopExecEdges, 'loop exec edges').sourcePortId).toBe(
      'loop',
    )
    expect(requireFirst(loopExecEdges, 'loop exec edges').targetNodeId).toBe(
      'body',
    )
    // No data edges from loop node in this test (no item/index connections)
    const loopDataEdges = graphIdx.outgoingDataByNode.get('for1') ?? []
    expect(loopDataEdges).toHaveLength(0)

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    // Loop structure must be present
    expect(lua).toContain('for i =')

    // Exact occurrence counts
    expect(lua.match(/vim\.cmd/g)).toHaveLength(1)
    expect(lua.match(/echo i/g)).toHaveLength(1)

    // Body action must appear inside the loop
    assertAppearsInside(lua, 'echo i', 'for i =', 'end')

    // No generation errors
    const genErrors = diagnostics
      .getErrors()
      .filter((e) => e.category !== 'cycle')
    expect(genErrors).toHaveLength(0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 14.6 Port ID mismatch: code-block done port
  // ─────────────────────────────────────────────────────────────────────────
  it('14.6 code-block done port is classified as EXEC, enabling successor action', () => {
    // BEFORE FIX: code-block's 'done' port was not in isExecEdge(),
    // so the edge from block.done -> after.exec was classified as data.
    // Only the code block appeared, successor was dropped:
    //   print(1)
    //   (missing: vim.opt.number = true)

    const graph = new GraphBuilder('CodeBlock-14.6', 'codeblock-14-6')
      .startupTrigger('trigger')
      .codeBlock('block', 'print(1)')
      .action('after', 'set-option', setNumberTrue)
      .connectExec('trigger', 'block')
      .connectExec('block', 'after') // edge: block.done -> after.exec
      .build()

    // Direct port classification check
    const indexed = buildGraphIndexes([graph])
    const graphIdx = requireIndexedGraph(indexed, graph.id)
    const blockExecEdges = graphIdx.outgoingExecByNode.get('block') ?? []
    const blockDataEdges = graphIdx.outgoingDataByNode.get('block') ?? []
    expect(blockExecEdges).toHaveLength(1)
    expect(
      requireFirst(blockExecEdges, 'code-block exec edges').sourcePortId,
    ).toBe('done')
    expect(blockDataEdges).toHaveLength(0)

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    // Both the code block and the subsequent action must be present
    expect(lua).toContain('print(1)')
    expect(lua).toContain('vim.opt.number = true')

    // Code block output must appear before the successor action
    assertAppearsAfter(lua, 'vim.opt.number = true', 'print(1)')

    // Exact occurrence counts
    expect(lua.match(/print\(1\)/g)).toHaveLength(1)
    expect(lua.match(/vim\.opt\.number = true/g)).toHaveLength(1)

    // No errors
    expect(diagnostics.hasErrors()).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 14.7 Double emission prevention: condition branches
  // ─────────────────────────────────────────────────────────────────────────
  it('14.7 condition branch code appears exactly once (no double emission)', () => {
    // BEFORE FIX: Branch nodes were emitted both inside the if/else block
    // (by renderExecFromPort) AND again as standalone compilation units
    // by the outer DFS traverse(). Result: duplicated code:
    //   if x > 5 then
    //     vim.opt.number = true
    //   else
    //     vim.opt.wrap = false
    //   end
    //   vim.opt.number = true   -- DUPLICATE (standalone unit)
    //   vim.opt.wrap = false     -- DUPLICATE (standalone unit)

    const graph = new GraphBuilder('Condition-14.7', 'condition-14-7')
      .startupTrigger('trigger')
      .condition('cond', '>', 'x', '5')
      .action('trueAction', 'set-option', setNumberTrue)
      .action('falseAction', 'set-option', setWrapFalse)
      .connectExec('trigger', 'cond')
      .connectTrue('cond', 'trueAction')
      .connectFalse('cond', 'falseAction')
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    // Both branches must be present
    expect(lua).toContain('vim.opt.number = true')
    expect(lua).toContain('vim.opt.wrap = false')

    // Count occurrences — each must appear exactly once
    const numberMatches = lua.match(/vim\.opt\.number = true/g)
    const wrapMatches = lua.match(/vim\.opt\.wrap = false/g)
    expect(numberMatches).toHaveLength(1)
    expect(wrapMatches).toHaveLength(1)

    // Must be inside an if/else block
    expect(lua).toContain('if ')
    expect(lua).toContain('else')

    // Structural positions: true branch between if and else, false between else and end
    const ifIdx = lua.indexOf('if ')
    const elseIdx = lua.indexOf('else')
    const endIdx = lua.indexOf('end', elseIdx)
    const numberIdx = lua.indexOf('vim.opt.number = true')
    const wrapIdx = lua.indexOf('vim.opt.wrap = false')

    expect(numberIdx).toBeGreaterThan(ifIdx)
    expect(numberIdx).toBeLessThan(elseIdx)
    expect(wrapIdx).toBeGreaterThan(elseIdx)
    expect(wrapIdx).toBeLessThan(endIdx)

    // No code should appear AFTER the if/else/end block
    const afterEnd = lua.slice(endIdx + 3).trim()
    expect(afterEnd).not.toContain('vim.opt')

    // No errors
    expect(diagnostics.hasErrors()).toBe(false)

    assertBlocksBalanced(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 14.8 Double emission prevention: loop body
  // ─────────────────────────────────────────────────────────────────────────
  it('14.8 loop body code appears exactly once (inside loop, not also outside)', () => {
    // BEFORE FIX: Loop body nodes were emitted inside the for block
    // (by renderExecFromPort) AND again as standalone units after the loop.
    // Result:
    //   for i = 1, 5 do
    //     vim.opt.number = true
    //   end
    //   vim.opt.number = true   -- DUPLICATE (standalone unit)

    const graph = new GraphBuilder('Loop-14.8', 'loop-14-8')
      .startupTrigger('trigger')
      .loop('for1', 'for', 'i', '1, 5')
      .action('body', 'set-option', setNumberTrue)
      .connectExec('trigger', 'for1')
      .connectLoopBody('for1', 'body')
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    // The body action must be present
    expect(lua).toContain('vim.opt.number = true')

    // It must appear exactly once
    const matches = lua.match(/vim\.opt\.number = true/g)
    expect(matches).toHaveLength(1)

    // It must appear inside the for loop (between 'for' and the final 'end')
    const forIdx = lua.indexOf('for i =')
    const endIdx = lua.lastIndexOf('end')
    const bodyIdx = lua.indexOf('vim.opt.number = true')
    expect(bodyIdx).toBeGreaterThan(forIdx)
    expect(bodyIdx).toBeLessThan(endIdx)

    // No code should appear AFTER the loop's 'end'
    const afterEnd = lua.slice(endIdx + 3).trim()
    expect(afterEnd).not.toContain('vim.opt')
    expect(afterEnd).not.toContain('vim.cmd')

    // No errors
    const genErrors = diagnostics
      .getErrors()
      .filter((e) => e.category !== 'cycle')
    expect(genErrors).toHaveLength(0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 14.9 Merge point detection with autocmd callback — REWRITTEN
  // ─────────────────────────────────────────────────────────────────────────
  it('14.9 merge point detection with autocmd callback produces no structural errors', () => {
    // Original bug: when one branch of a condition contained an autocmd with an on-event
    // callback, the callback node was incorrectly considered a synchronous
    // successor, causing merge-point detection to fail or misidentify the merge.
    //
    // Graph: Startup -> Cond -> [true] -> Autocmd(on-event -> Callback)
    //                        -> [false] -> PlainAction
    //                   (no explicit merge point)
    //
    // The key correctness property: generation must succeed without structural errors,
    // the if block must be present, both branches produce their code, and blocks are
    // balanced. The callback body must be embedded inside the autocmd (not leaked
    // outside as a standalone statement after the if block).

    const graph = new GraphBuilder('Merge-14.9', 'merge-14-9')
      .startupTrigger('trigger')
      .condition('cond', '>', 'x', '0')
      .action(
        'autocmd',
        'create-autocmd',
        defaultAutocmdConfig(['BufEnter'], ['*.lua']),
      )
      .action('callback', 'set-option', setNumberTrue)
      .action('plainAction', 'set-option', setWrapFalse)
      .connectExec('trigger', 'cond')
      .connectTrue('cond', 'autocmd')
      .connect('autocmd', 'callback', 'on-event', 'exec')
      .connectFalse('cond', 'plainAction')
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    // Generation must succeed without structural errors
    expect(
      diagnostics.getErrors().filter((e) => e.category === 'structure'),
    ).toHaveLength(0)

    // Both branches must produce code
    expect(lua).toContain('nvim_create_autocmd')
    expect(lua).toContain('vim.opt.wrap = false')

    // The autocmd callback must be present
    expect(lua).toContain('vim.opt.number = true')

    // The if block must be present (condition not collapsed)
    expect(lua).toContain('if ')

    // Callback body must be embedded in the autocmd call (inline), not leaked
    // outside as a standalone statement after the autocmd call.
    // The emitter inlines simple single-action callbacks on the autocmd line.
    const autocmdLineIdx = lua.indexOf('nvim_create_autocmd')
    const autocmdLineEnd =
      autocmdLineIdx + lua.slice(autocmdLineIdx).indexOf('\n')
    const callbackIdx = lua.indexOf('vim.opt.number = true')
    expect(callbackIdx).toBeLessThanOrEqual(autocmdLineEnd)

    // Block balance must be correct (no missing 'end')
    assertBlocksBalanced(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 14.10 Create-autocmd with both done and on-event
  // ─────────────────────────────────────────────────────────────────────────
  it('14.10 create-autocmd with both done and on-event produces no ambiguous-continuation warning', () => {
    // BEFORE FIX: getNextNodes() counted both 'on-event' and 'done' as
    // continuation edges, triggering the ambiguous-exec-continuation warning.
    // The DFS picked the first edge by lexicographic sort, which could be
    // 'on-event' — embedding the main-flow code inside the callback:
    //   vim.api.nvim_create_autocmd({ "FileType" }, {
    //     callback = function()
    //       vim.opt.number = true
    //       vim.opt.wrap = false   -- WRONG: main flow inside callback
    //     end,
    //   })

    const graph = new GraphBuilder('Autocmd-14.10', 'autocmd-14-10')
      .startupTrigger('trigger')
      .action(
        'autocmd',
        'create-autocmd',
        defaultAutocmdConfig(['FileType'], ['*.ts']),
      )
      .action('callback', 'set-option', setNumberTrue) // on-event (callback body)
      .action('thenAction', 'set-option', setWrapFalse) // done (main flow)
      .connectExec('trigger', 'autocmd')
      .connect('autocmd', 'callback', 'on-event', 'exec') // callback
      .connectExec('autocmd', 'thenAction') // main flow continuation via done port
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    // No ambiguous-continuation warning
    const ambigWarning = diagnostics
      .getWarnings()
      .find((w) => w.id === 'ambiguous-exec-continuation')
    expect(ambigWarning).toBeUndefined()

    // thenAction must appear in main flow
    expect(lua).toContain('vim.opt.wrap = false')

    // callback must appear inside the autocmd callback
    expect(lua).toContain('vim.opt.number = true')

    // Both sections must be present
    expect(lua).toContain('nvim_create_autocmd')
    expect(lua).toContain('FileType')

    // Structural: callback body embedded in autocmd call, main flow after
    // Use nvim_create_autocmd line as the boundary
    const autocmdCallIdx = lua.indexOf('nvim_create_autocmd')
    const numberIdx = lua.indexOf('vim.opt.number = true')

    // Callback body appears on/before the autocmd call line (embedded inline)
    const autocmdLineEnd =
      autocmdCallIdx + lua.slice(autocmdCallIdx).indexOf('\n')
    expect(numberIdx).toBeLessThanOrEqual(autocmdLineEnd)

    // Main flow appears after the autocmd call
    assertAppearsAfter(lua, 'vim.opt.wrap = false', 'nvim_create_autocmd')

    // Each appears exactly once
    expect(lua.match(/vim\.opt\.wrap = false/g)).toHaveLength(1)
    expect(lua.match(/vim\.opt\.number = true/g)).toHaveLength(1)

    assertBlocksBalanced(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 14.11 Edge sort order doesn't affect autocmd continuation
  // ─────────────────────────────────────────────────────────────────────────
  it('14.11 done continuation is followed regardless of edge ID sort order', () => {
    // BEFORE FIX: getNextNodes() sorted all outgoing exec edges by edgeId
    // and the generic linear-node handler picked the first non-callback edge.
    // But CALLBACK_EXEC_PORTS was not yet implemented, so 'on-event' was
    // treated as a regular continuation. With edge ID 'aaa-on-event-edge'
    // sorting before 'zzz-done-edge', the callback was followed as main flow:
    //   vim.api.nvim_create_autocmd({ "BufWritePost" }, {
    //     callback = function()
    //       vim.opt.number = true
    //       vim.opt.wrap = false   -- WRONG: main flow inside callback
    //     end,
    //   })
    //   (missing: vim.opt.wrap = false in main flow)

    const graph = new GraphBuilder('Sort-14.11', 'sort-14-11')
      .startupTrigger('trigger')
      .action(
        'autocmd',
        'create-autocmd',
        defaultAutocmdConfig(['BufWritePost'], ['*.lua']),
      )
      .action('callbackNode', 'set-option', setNumberTrue)
      .action('mainFlow', 'set-option', setWrapFalse)
      .connectExec('trigger', 'autocmd')
      // Explicit edge IDs: 'aaa-...' sorts before 'zzz-...'
      .connect(
        'autocmd',
        'callbackNode',
        'on-event',
        'exec',
        'aaa-on-event-edge',
      )
      .connect('autocmd', 'mainFlow', 'done', 'exec', 'zzz-done-edge')
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    // No ambiguous-continuation warning
    const ambigWarning = diagnostics
      .getWarnings()
      .find((w) => w.id === 'ambiguous-exec-continuation')
    expect(ambigWarning).toBeUndefined()

    // Both the main-flow action and the callback action must be present
    expect(lua).toContain('vim.opt.wrap = false') // mainFlow (done)
    expect(lua).toContain('vim.opt.number = true') // callbackNode (on-event)

    // The autocmd must be registered
    expect(lua).toContain('nvim_create_autocmd')
    expect(lua).toContain('BufWritePost')

    // Structural: main flow must appear after the autocmd call (not embedded inside)
    assertAppearsAfter(lua, 'vim.opt.wrap = false', 'nvim_create_autocmd')

    // Callback body embedded in autocmd line (inline callback)
    const autocmdCallIdx = lua.indexOf('nvim_create_autocmd')
    const numberIdx = lua.indexOf('vim.opt.number = true')
    const autocmdLineEnd =
      autocmdCallIdx + lua.slice(autocmdCallIdx).indexOf('\n')
    expect(numberIdx).toBeLessThanOrEqual(autocmdLineEnd)

    // Exact counts
    expect(lua.match(/vim\.opt\.wrap = false/g)).toHaveLength(1)
    expect(lua.match(/vim\.opt\.number = true/g)).toHaveLength(1)

    assertBlocksBalanced(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Lua syntax validation (requires luac on PATH)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Lua syntax validation', () => {
    it('14.1 trigger chain produces syntactically valid Lua', async () => {
      const graph = new GraphBuilder('LuaValid-14.1', 'luavalid-14-1')
        .startupTrigger('trigger')
        .action('setOpt', 'set-option', setNumberTrue)
        .connectExec('trigger', 'setOpt')
        .build()

      const { lua } = generateLuaFromGraphs([graph])
      await assertLuaSyntaxValid(lua)
    })

    it('14.7 condition branches produce syntactically valid Lua', async () => {
      const graph = new GraphBuilder('LuaValid-14.7', 'luavalid-14-7')
        .startupTrigger('trigger')
        .condition('cond', '>', 'x', '5')
        .action('trueAction', 'set-option', setNumberTrue)
        .action('falseAction', 'set-option', setWrapFalse)
        .connectExec('trigger', 'cond')
        .connectTrue('cond', 'trueAction')
        .connectFalse('cond', 'falseAction')
        .build()

      const { lua } = generateLuaFromGraphs([graph])
      await assertLuaSyntaxValid(lua)
    })

    it('14.5 loop body produces syntactically valid Lua', async () => {
      const graph = new GraphBuilder('LuaValid-14.5', 'luavalid-14-5')
        .startupTrigger('trigger')
        .loop('for1', 'for', 'i', '1, 3')
        .action('body', 'run-action', runCommand('echo i'))
        .connectExec('trigger', 'for1')
        .connectLoopBody('for1', 'body')
        .build()

      const { lua } = generateLuaFromGraphs([graph])
      await assertLuaSyntaxValid(lua)
    })
  })
})

// ---------------------------------------------------------------------------
// Part 2: Port Classification Contract Matrix
// ---------------------------------------------------------------------------

/**
 * Edge Classification Reference Table
 *
 * This table documents the complete exec vs data port contract for every
 * node type in the system. If a new node type or port is added, a row
 * MUST be added here.
 *
 * | Node Type         | Port ID    | Classification | Notes                          |
 * |-------------------|------------|----------------|--------------------------------|
 * | trigger           | exec       | EXEC           | Only output port               |
 * | callable-entry    | exec       | EXEC           | Only exec output; params=data  |
 * | callable-entry    | <param-id> | DATA           | Dynamic: one per parameter     |
 * | action            | done       | EXEC           | Standard continuation          |
 * | action:autocmd    | on-event   | EXEC           | Callback port (deferred)       |
 * | condition         | true       | EXEC           | True branch                    |
 * | condition         | false      | EXEC           | False branch                   |
 * | condition         | done       | EXEC           | Post-branch continuation       |
 * | loop              | loop       | EXEC           | Loop body                      |
 * | loop              | done       | EXEC           | Loop completion                |
 * | loop              | complete   | EXEC           | Alias for done                 |
 * | code-block        | done       | EXEC           | Continuation                   |
 * | code-block        | <output>   | DATA           | User-defined data outputs      |
 * | graph-ref         | done       | EXEC           | Continuation                   |
 * | graph-ref         | <ret-id>   | DATA           | Dynamic: one per return value  |
 * | run-function      | done       | EXEC           | Continuation                   |
 * | builtin           | done       | EXEC           | Continuation                   |
 * | return            | (none)     | N/A            | No output ports                |
 */

describe('Port classification contract matrix', () => {
  /** Build a minimal graph with one source node and one edge from the given port */
  function buildClassificationTestGraph(
    nodeType: string,
    portId: string,
  ): Graph {
    const builder = new GraphBuilder(
      `classify-${nodeType}-${portId}`,
      `classify-${nodeType}-${portId}`,
    )
    // Add a dummy target action node that all edges point to
    builder.action('target', 'set-option', setNumberTrue)

    switch (nodeType) {
      case 'trigger':
        builder.startupTrigger('source')
        break
      case 'callable-entry':
        builder.callableEntry('source')
        break
      case 'callable-entry:with-param': {
        const param = createCallablePort('param-abc', 'Test Param')
        builder.callableEntry('source', [param])
        break
      }
      case 'action:set-option':
        builder.action('source', 'set-option', setNumberTrue)
        break
      case 'action:create-autocmd':
        builder.action(
          'source',
          'create-autocmd',
          defaultAutocmdConfig(['BufEnter'], ['*']),
        )
        break
      case 'condition':
        builder.condition('source', '>', 'x', '0')
        break
      case 'loop':
        builder.loop('source', 'for', 'i', '1, 3')
        break
      case 'code-block':
        builder.codeBlock('source', 'print(1)')
        break
      case 'code-block-with-output':
        builder.codeBlock(
          'source',
          'return 42',
          [],
          [{ id: 'result', name: 'Result', dataType: 'any' }],
        )
        break
      case 'graph-ref':
        builder.graphRef('source', 'some-graph')
        break
      case 'graph-ref:with-return': {
        // GraphRefNodeData with cachedContract containing a return value port
        // Use graphRef method then modify via a raw approach — inject cachedContract
        // by building manually with the node already created
        builder.graphRef('source', 'some-graph')
        // We can't set cachedContract via GraphBuilder, but isExecEdge uses
        // only the node data to classify edges — for graph-ref, 'done' is exec
        // and anything else is data. The portId 'ret-xyz' will not match 'done'
        // so it will be treated as data by the default branch of isExecEdge.
        // The cachedContract affects the UI port rendering, not edge classification.
        break
      }
      case 'run-function':
        builder.runFunction('source', 'vim.fn.expand', {
          type: 'core',
          functionName: 'vim.fn.expand',
        })
        break
      case 'builtin':
        builder.builtin('source', 'input.prompt')
        break
      default:
        throw new Error(`Unknown nodeType for classification test: ${nodeType}`)
    }

    builder.connect('source', 'target', portId, 'exec')
    return builder.build()
  }

  const EXEC_PORT_CONTRACT: Array<{
    nodeType: string
    portId: string
    expected: 'exec' | 'data'
    description: string
  }> = [
    // Trigger
    {
      nodeType: 'trigger',
      portId: 'exec',
      expected: 'exec',
      description: 'trigger startup output',
    },

    // Callable Entry — exec output is EXEC; parameter outputs are DATA
    {
      nodeType: 'callable-entry',
      portId: 'exec',
      expected: 'exec',
      description: 'callable entry exec output',
    },
    {
      nodeType: 'callable-entry:with-param',
      portId: 'param-abc',
      expected: 'data',
      description: 'callable-entry parameter output (dynamic DATA port)',
    },

    // Action (set-option as representative)
    {
      nodeType: 'action:set-option',
      portId: 'done',
      expected: 'exec',
      description: 'action done continuation',
    },

    // Action (create-autocmd — has both done and on-event)
    {
      nodeType: 'action:create-autocmd',
      portId: 'done',
      expected: 'exec',
      description: 'autocmd done continuation',
    },
    {
      nodeType: 'action:create-autocmd',
      portId: 'on-event',
      expected: 'exec',
      description: 'autocmd callback port',
    },

    // Condition
    {
      nodeType: 'condition',
      portId: 'true',
      expected: 'exec',
      description: 'condition true branch',
    },
    {
      nodeType: 'condition',
      portId: 'false',
      expected: 'exec',
      description: 'condition false branch',
    },
    {
      nodeType: 'condition',
      portId: 'done',
      expected: 'exec',
      description: 'condition done continuation',
    },

    // Loop
    {
      nodeType: 'loop',
      portId: 'loop',
      expected: 'exec',
      description: 'loop body port',
    },
    {
      nodeType: 'loop',
      portId: 'done',
      expected: 'exec',
      description: 'loop done/complete port',
    },
    {
      nodeType: 'loop',
      portId: 'complete',
      expected: 'exec',
      description: 'loop complete alias',
    },

    // Code Block (exec port)
    {
      nodeType: 'code-block',
      portId: 'done',
      expected: 'exec',
      description: 'code-block done continuation',
    },

    // Code Block (data output port)
    {
      nodeType: 'code-block-with-output',
      portId: 'result',
      expected: 'data',
      description: 'code-block data output',
    },

    // Graph Ref — done is EXEC; return value outputs are DATA
    {
      nodeType: 'graph-ref',
      portId: 'done',
      expected: 'exec',
      description: 'graph-ref done continuation',
    },
    {
      nodeType: 'graph-ref:with-return',
      portId: 'ret-xyz',
      expected: 'data',
      description: 'graph-ref return output (dynamic DATA port)',
    },

    // Run Function
    {
      nodeType: 'run-function',
      portId: 'done',
      expected: 'exec',
      description: 'run-function done continuation',
    },

    // Builtin
    {
      nodeType: 'builtin',
      portId: 'done',
      expected: 'exec',
      description: 'builtin done continuation',
    },
  ]

  it.each(
    EXEC_PORT_CONTRACT,
  )('$description: $portId on $nodeType is $expected', ({
    nodeType,
    portId,
    expected,
  }) => {
    const graph = buildClassificationTestGraph(nodeType, portId)
    const indexed = buildGraphIndexes([graph])
    const graphIdx = requireIndexedGraph(indexed, graph.id)

    const sourceNodeId = 'source'
    const execEdges = graphIdx.outgoingExecByNode.get(sourceNodeId) ?? []
    const dataEdges = graphIdx.outgoingDataByNode.get(sourceNodeId) ?? []

    if (expected === 'exec') {
      expect(
        execEdges.some((e) => e.sourcePortId === portId),
        `${portId} should be in exec edges`,
      ).toBe(true)
      expect(
        dataEdges.some((e) => e.sourcePortId === portId),
        `${portId} should NOT be in data edges`,
      ).toBe(false)
    } else {
      expect(
        dataEdges.some((e) => e.sourcePortId === portId),
        `${portId} should be in data edges`,
      ).toBe(true)
      expect(
        execEdges.some((e) => e.sourcePortId === portId),
        `${portId} should NOT be in exec edges`,
      ).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Part 3: Edge Sort Order Variation Tests (14.11 family)
// ---------------------------------------------------------------------------

describe('Edge sort order variations (14.11 family)', () => {
  // Variation A: on-event sorts AFTER done (inverted order vs 14.11)
  // Validates the fix works regardless of which edge sorts first.
  it('14.11a done continuation works when done edge sorts BEFORE on-event', () => {
    // BEFORE FIX (same as 14.11): CALLBACK_EXEC_PORTS not implemented, so
    // on-event treated as a continuation. With 'aaa-done-edge' sorting before
    // 'zzz-on-event-edge', the done edge was picked first — this variant
    // would appear to pass even without the fix! The real test is 14.11.
    // This variant confirms the fix is symmetric: both orderings work correctly.

    const graph = new GraphBuilder('Sort-14.11a', 'sort-14-11a')
      .startupTrigger('trigger')
      .action(
        'autocmd',
        'create-autocmd',
        defaultAutocmdConfig(['BufWritePost'], ['*.lua']),
      )
      .action('callbackNode', 'set-option', setNumberTrue)
      .action('mainFlow', 'set-option', setWrapFalse)
      .connectExec('trigger', 'autocmd')
      // 'aaa-done-edge' sorts BEFORE 'zzz-on-event-edge' — opposite of 14.11
      .connect('autocmd', 'mainFlow', 'done', 'exec', 'aaa-done-edge')
      .connect(
        'autocmd',
        'callbackNode',
        'on-event',
        'exec',
        'zzz-on-event-edge',
      )
      .build()

    // Same structural assertions as 14.11 — both edge orderings must produce
    // identical behavior. If the fix relies on edge ordering rather than port
    // semantics, one variant will fail while the other passes.
    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    const ambigWarning = diagnostics
      .getWarnings()
      .find((w) => w.id === 'ambiguous-exec-continuation')
    expect(ambigWarning).toBeUndefined()

    expect(lua).toContain('vim.opt.wrap = false') // mainFlow (done)
    expect(lua).toContain('vim.opt.number = true') // callbackNode (on-event)
    expect(lua).toContain('nvim_create_autocmd')

    // Main flow must appear AFTER the autocmd call (not embedded in callback)
    assertAppearsAfter(lua, 'vim.opt.wrap = false', 'nvim_create_autocmd')

    // Callback body embedded inline in the autocmd call line
    const autocmdCallIdx = lua.indexOf('nvim_create_autocmd')
    const numberIdx = lua.indexOf('vim.opt.number = true')
    const autocmdLineEnd =
      autocmdCallIdx + lua.slice(autocmdCallIdx).indexOf('\n')
    expect(numberIdx).toBeLessThanOrEqual(autocmdLineEnd)

    expect(lua.match(/vim\.opt\.wrap = false/g)).toHaveLength(1)
    expect(lua.match(/vim\.opt\.number = true/g)).toHaveLength(1)

    assertBlocksBalanced(lua)
  })

  // Variation B: near-identical numeric edge IDs (tiebreaker stress)
  // Edge IDs 'edge-001' (on-event) and 'edge-002' (done) are close in sort order.
  // Ensures the fix doesn't rely on a large lexicographic gap between IDs.
  it('14.11b done continuation works with near-identical numeric edge IDs', () => {
    const graph = new GraphBuilder('Sort-14.11b', 'sort-14-11b')
      .startupTrigger('trigger')
      .action(
        'autocmd',
        'create-autocmd',
        defaultAutocmdConfig(['BufWritePost'], ['*.lua']),
      )
      .action('callbackNode', 'set-option', setNumberTrue)
      .action('mainFlow', 'set-option', setWrapFalse)
      .connectExec('trigger', 'autocmd')
      .connect('autocmd', 'callbackNode', 'on-event', 'exec', 'edge-001')
      .connect('autocmd', 'mainFlow', 'done', 'exec', 'edge-002')
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    const ambigWarning = diagnostics
      .getWarnings()
      .find((w) => w.id === 'ambiguous-exec-continuation')
    expect(ambigWarning).toBeUndefined()

    expect(lua).toContain('vim.opt.wrap = false')
    expect(lua).toContain('vim.opt.number = true')
    expect(lua).toContain('nvim_create_autocmd')

    assertAppearsAfter(lua, 'vim.opt.wrap = false', 'nvim_create_autocmd')

    const autocmdCallIdx = lua.indexOf('nvim_create_autocmd')
    const numberIdx = lua.indexOf('vim.opt.number = true')
    const autocmdLineEnd =
      autocmdCallIdx + lua.slice(autocmdCallIdx).indexOf('\n')
    expect(numberIdx).toBeLessThanOrEqual(autocmdLineEnd)

    expect(lua.match(/vim\.opt\.wrap = false/g)).toHaveLength(1)
    expect(lua.match(/vim\.opt\.number = true/g)).toHaveLength(1)

    assertBlocksBalanced(lua)
  })

  // Variation C: nodes added in reverse execution order — construction order must not affect output
  it('14.11c done continuation works regardless of node insertion order', () => {
    // Nodes added in reverse execution order — mainFlow first, trigger last.
    // Output must be identical to 14.11.
    const graph = new GraphBuilder('Sort-14.11c', 'sort-14-11c')
      // Nodes added in reverse execution order — mainFlow first, trigger last
      .action('mainFlow', 'set-option', setWrapFalse)
      .action('callbackNode', 'set-option', setNumberTrue)
      .action(
        'autocmd',
        'create-autocmd',
        defaultAutocmdConfig(['BufWritePost'], ['*.lua']),
      )
      .startupTrigger('trigger')
      .connectExec('trigger', 'autocmd')
      .connect(
        'autocmd',
        'callbackNode',
        'on-event',
        'exec',
        'aaa-on-event-edge',
      )
      .connect('autocmd', 'mainFlow', 'done', 'exec', 'zzz-done-edge')
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    const ambigWarning = diagnostics
      .getWarnings()
      .find((w) => w.id === 'ambiguous-exec-continuation')
    expect(ambigWarning).toBeUndefined()

    expect(lua).toContain('vim.opt.wrap = false')
    expect(lua).toContain('vim.opt.number = true')
    expect(lua).toContain('nvim_create_autocmd')

    assertAppearsAfter(lua, 'vim.opt.wrap = false', 'nvim_create_autocmd')

    const autocmdCallIdx = lua.indexOf('nvim_create_autocmd')
    const numberIdx = lua.indexOf('vim.opt.number = true')
    const autocmdLineEnd =
      autocmdCallIdx + lua.slice(autocmdCallIdx).indexOf('\n')
    expect(numberIdx).toBeLessThanOrEqual(autocmdLineEnd)

    expect(lua.match(/vim\.opt\.wrap = false/g)).toHaveLength(1)
    expect(lua.match(/vim\.opt\.number = true/g)).toHaveLength(1)

    assertBlocksBalanced(lua)
  })
})

// ---------------------------------------------------------------------------
// Part 4: Merge Point Detection Tests (14.9 family)
// ---------------------------------------------------------------------------

describe('Merge point detection (14.9 family)', () => {
  // 4A.1: Classic diamond — both branches merge at a single node
  it('14.9a diamond pattern: shared merge node emitted exactly once (no double emission)', () => {
    // Startup -> Cond -> [true] -> ActionA -> MergeNode
    //                 -> [false] -> ActionB -> MergeNode
    //
    // Key regression property: MergeNode must appear exactly once in the output.
    // If the double-emission guard were absent, it would appear twice (once per branch).
    const graph = new GraphBuilder('Diamond-14.9a', 'diamond-14-9a')
      .startupTrigger('trigger')
      .condition('cond', '>', 'x', '5')
      .action('trueAction', 'set-option', setNumberTrue)
      .action('falseAction', 'run-action', runCommand('echo false'))
      .action('mergeNode', 'set-option', setWrapFalse)
      .connectExec('trigger', 'cond')
      .connectTrue('cond', 'trueAction')
      .connectFalse('cond', 'falseAction')
      .connectExec('trueAction', 'mergeNode')
      .connectExec('falseAction', 'mergeNode')
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    expect(diagnostics.hasErrors()).toBe(false)

    // Merge node appears exactly once (no double emission from two branches reaching it)
    expect(lua.match(/vim\.opt\.wrap = false/g)).toHaveLength(1)

    // Both branches must be present
    expect(lua).toContain('vim.opt.number = true')
    expect(lua).toContain('echo false')

    // If/else block must be present
    expect(lua).toContain('if ')

    assertBlocksBalanced(lua)
  })

  // 4A.3: Diamond with autocmd on both branches + explicit merge
  it('14.9c diamond with autocmd on both branches merges correctly', () => {
    // Startup -> Cond -> [true]  -> Autocmd1(on-event -> CB1) -> Autocmd1.done -> Merge
    //                 -> [false] -> Autocmd2(on-event -> CB2) -> Autocmd2.done -> Merge
    const graph = new GraphBuilder('Diamond-14.9c', 'diamond-14-9c')
      .startupTrigger('trigger')
      .condition('cond', '>', 'x', '0')
      .action(
        'autocmd1',
        'create-autocmd',
        defaultAutocmdConfig(['BufEnter'], ['*']),
      )
      .action('cb1', 'run-action', runCommand('echo cb1'))
      .action(
        'autocmd2',
        'create-autocmd',
        defaultAutocmdConfig(['BufLeave'], ['*']),
      )
      .action('cb2', 'run-action', runCommand('echo cb2'))
      .action('merge', 'set-option', setWrapFalse)
      .connectExec('trigger', 'cond')
      .connectTrue('cond', 'autocmd1')
      .connect('autocmd1', 'cb1', 'on-event', 'exec')
      .connect('autocmd1', 'merge', 'done', 'exec')
      .connectFalse('cond', 'autocmd2')
      .connect('autocmd2', 'cb2', 'on-event', 'exec')
      .connect('autocmd2', 'merge', 'done', 'exec')
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    expect(
      diagnostics.getErrors().filter((e) => e.category === 'structure'),
    ).toHaveLength(0)

    // Merge action appears exactly once
    expect(lua.match(/vim\.opt\.wrap = false/g)).toHaveLength(1)

    // Both callbacks inside their respective autocmd callbacks
    expect(lua).toContain('echo cb1')
    expect(lua).toContain('echo cb2')

    // Both autocmd registrations present
    expect(lua).toContain('BufEnter')
    expect(lua).toContain('BufLeave')

    assertBlocksBalanced(lua)
  })

  // 4A.4: Asymmetric diamond — one branch has more nodes before merge
  it('14.9d asymmetric diamond: long true branch, short false branch', () => {
    // Startup -> Cond -> [true]  -> A1 -> A2 -> A3 -> Merge
    //                 -> [false] -> B1 ─────────────-> Merge
    const graph = new GraphBuilder('Asym-14.9d', 'asym-14-9d')
      .startupTrigger('trigger')
      .condition('cond', '>', 'x', '0')
      .action('a1', 'run-action', runCommand('echo a1'))
      .action('a2', 'run-action', runCommand('echo a2'))
      .action('a3', 'run-action', runCommand('echo a3'))
      .action('b1', 'run-action', runCommand('echo b1'))
      .action('merge', 'set-option', setWrapFalse)
      .connectExec('trigger', 'cond')
      .connectTrue('cond', 'a1')
      .connectExec('a1', 'a2')
      .connectExec('a2', 'a3')
      .connectExec('a3', 'merge')
      .connectFalse('cond', 'b1')
      .connectExec('b1', 'merge')
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    expect(diagnostics.hasErrors()).toBe(false)

    // Merge appears exactly once
    expect(lua.match(/vim\.opt\.wrap = false/g)).toHaveLength(1)

    // True branch has all three actions in order
    const a1Idx = lua.indexOf('echo a1')
    const a2Idx = lua.indexOf('echo a2')
    const a3Idx = lua.indexOf('echo a3')
    expect(a1Idx).toBeGreaterThanOrEqual(0)
    expect(a2Idx).toBeGreaterThan(a1Idx)
    expect(a3Idx).toBeGreaterThan(a2Idx)

    assertBlocksBalanced(lua)
  })

  // 4A.5: No merge point — branches terminate independently
  it('14.9e no merge point: independent branch termination', () => {
    const graph = new GraphBuilder('NoMerge-14.9e', 'nomerge-14-9e')
      .startupTrigger('trigger')
      .condition('cond', '>', 'x', '0')
      .action('trueAction', 'set-option', setNumberTrue)
      .action('falseAction', 'set-option', setWrapFalse)
      .connectExec('trigger', 'cond')
      .connectTrue('cond', 'trueAction')
      .connectFalse('cond', 'falseAction')
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    expect(diagnostics.hasErrors()).toBe(false)

    // Both branches present, each exactly once
    expect(lua.match(/vim\.opt\.number = true/g)).toHaveLength(1)
    expect(lua.match(/vim\.opt\.wrap = false/g)).toHaveLength(1)

    // No code after the if/else/end block
    const elseIdx = lua.indexOf('else')
    const endIdx = lua.indexOf('end', elseIdx)
    const afterEnd = lua.slice(endIdx + 3).trim()
    expect(afterEnd).not.toContain('vim.opt')

    assertBlocksBalanced(lua)
  })
})

// ---------------------------------------------------------------------------
// Part 4B: Callback vs Continuation Merge Isolation
// ---------------------------------------------------------------------------

describe('Callback vs continuation merge isolation', () => {
  it('14.9f callback-only paths: shared node in callback is not leaked outside autocmd call', () => {
    // Startup -> Cond -> [true]  -> Autocmd(on-event -> SharedNode)
    //                 -> [false] -> SharedNode
    //
    // The key regression property: SharedNode's code must be embedded inside
    // the autocmd callback (inline). It must NOT appear as a standalone statement
    // after the autocmd call line (which would indicate the merge-detection bug
    // had incorrectly identified it as a post-if/else merge point).
    //
    // Due to the emitted-node deduplication guard, SharedNode is only emitted
    // once (inside the autocmd callback, which executes first during traversal).
    // The false-branch path to SharedNode is skipped because SharedNode was
    // already marked emitted. This is correct behavior — the node is not
    // incorrectly hoisted outside the if block as a "merge point".
    const graph = new GraphBuilder('CbMerge-14.9f', 'cbmerge-14-9f')
      .startupTrigger('trigger')
      .condition('cond', '>', 'x', '0')
      .action(
        'autocmd',
        'create-autocmd',
        defaultAutocmdConfig(['BufEnter'], ['*']),
      )
      .action('shared', 'set-option', setNumberTrue)
      .connectExec('trigger', 'cond')
      .connectTrue('cond', 'autocmd')
      .connect('autocmd', 'shared', 'on-event', 'exec') // callback path only
      .connectFalse('cond', 'shared') // direct continuation from false branch
      .build()

    const { lua, diagnostics } = generateLuaFromGraphs([graph])

    expect(
      diagnostics.getErrors().filter((e) => e.category === 'structure'),
    ).toHaveLength(0)

    // SharedNode must appear at least once (embedded in autocmd callback)
    expect(lua).toContain('vim.opt.number = true')

    // Autocmd must be present (true branch)
    expect(lua).toContain('nvim_create_autocmd')

    // The if block must be present
    expect(lua).toContain('if ')

    // SharedNode must be embedded in the autocmd call line (inline callback),
    // NOT appearing as a standalone statement after the autocmd call.
    // This proves it was not incorrectly hoisted as a merge point.
    const autocmdLineIdx = lua.indexOf('nvim_create_autocmd')
    const sharedIdx = lua.indexOf('vim.opt.number = true')
    const autocmdLineEnd =
      autocmdLineIdx + lua.slice(autocmdLineIdx).indexOf('\n')
    expect(
      sharedIdx,
      'SharedNode must be inside the autocmd call line (inline callback)',
    ).toBeLessThanOrEqual(autocmdLineEnd)

    // SharedNode must NOT appear after the if block's closing 'end'
    // (it should not be hoisted outside the conditional)
    const ifIdx = lua.indexOf('if ')
    const ifEndIdx = lua.indexOf('end', ifIdx)
    const afterIfBlock = lua.slice(ifEndIdx + 3).trim()
    expect(afterIfBlock).not.toContain('vim.opt.number = true')

    assertBlocksBalanced(lua)
  })
})
