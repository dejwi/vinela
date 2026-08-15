/**
 * Category 4: Loops
 *
 * Tests for loop node patterns:
 *   - For, while, each loop type generation
 *   - Body / completion structure (done port and complete-alias port)
 *   - Nested loops and loop+condition mixed control flow
 *   - Data binding (each-loop item port)
 *
 * Every test calls assertBlocksBalanced and assertLuaSyntaxValid.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { GraphBuilder } from '@/features/lua-generator/__tests__/utils/graph-builder'
import { createDefaultActionConfig } from '@/shared/types'
import { generateLuaFromGraph } from './helpers/generate-lua'
import {
  assertBlocksBalanced,
  assertLuaSyntaxValid,
  ensureLuaParserAvailable,
  expectAssignment,
  expectContainsAll,
  expectDeeper,
  expectInOrder,
  expectNestingDepth,
  expectNoOccurrence,
  expectOccursExactly,
} from './helpers/lua-assertions'
import { buildLoopWithBody } from './helpers/pattern-builders'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await ensureLuaParserAvailable()
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setOptionConfig(optionName: string, value: boolean | number = true) {
  return {
    ...createDefaultActionConfig('set-option'),
    optionName,
    scope: 'global' as const,
    valueConfig: { valueMode: 'suggested' as const, suggestedValue: value },
  }
}

function runCommandConfig(command: string) {
  return {
    ...createDefaultActionConfig('run-action'),
    mode: 'custom-command' as const,
    actionType: 'command' as const,
    action: command,
    selectedActionKey: '',
    paramValues: {},
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Category 4: Loops
// ─────────────────────────────────────────────────────────────────────────────

describe('Category 4: Loops', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Loop type generation
  // ───────────────────────────────────────────────────────────────────────────

  describe('loop type generation', () => {
    it('4.1 for loop with body', async () => {
      const { graph } = buildLoopWithBody({
        graphId: 'for-basic',
        loopType: 'for',
        iteratorVariable: 'i',
        iterableExpression: '1,10',
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Correct numeric for header
      expect(lua).toContain('for i = 1, 10 do')

      // Body option assignment present with correct value
      expectAssignment(lua, 'vim.opt.body_opt1', 'true')

      // Body is inside loop (greater indent than header)
      expectDeeper(lua, 'for i = 1, 10 do', 'vim.opt.body_opt1 = true')

      // Verify complete loop structure
      expectInOrder(lua, [
        'for i = 1, 10 do',
        'vim.opt.body_opt1 = true',
        'end',
      ])

      // Negative: wrong loop type (anchored)
      expect(lua).not.toMatch(/^\s*while\b.*\bdo\s*$/m)
      // Negative: wrong value
      expectNoOccurrence(lua, 'vim.opt.body_opt1 = false')

      await assertLuaSyntaxValid(lua)
    })

    it('4.3 while loop with body', async () => {
      const { graph } = buildLoopWithBody({
        graphId: 'while-basic',
        loopType: 'while',
        iteratorVariable: 'i',
        iterableExpression: 'running',
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Correct while header
      expect(lua).toContain('while running do')

      // Body inside loop with correct value
      expectAssignment(lua, 'vim.opt.body_opt1', 'true')
      expectDeeper(lua, 'while running do', 'vim.opt.body_opt1 = true')

      // Verify complete loop structure
      expectInOrder(lua, [
        'while running do',
        'vim.opt.body_opt1 = true',
        'end',
      ])

      // Negative: should not be a for loop (anchored)
      expect(lua).not.toMatch(/^\s*for\b.*\bdo\s*$/m)

      await assertLuaSyntaxValid(lua)
    })

    it('4.4 each loop with body (passes raw iterable, not pairs())', async () => {
      // Pass raw iterable name — generator wraps it with pairs() internally.
      // Passing pairs(my_table) would produce pairs(pairs(my_table)).
      const { graph } = buildLoopWithBody({
        graphId: 'each-basic',
        loopType: 'each',
        iteratorVariable: 'item',
        iterableExpression: 'my_table',
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Generator wraps with pairs() — assert the final form
      expect(lua).toContain('for _, item in pairs(my_table) do')

      // Body inside loop
      expect(lua).toContain('vim.opt.body_opt1')
      expectDeeper(
        lua,
        'for _, item in pairs(my_table) do',
        'vim.opt.body_opt1',
      )

      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Body / completion structure
  // ───────────────────────────────────────────────────────────────────────────

  describe('body/completion structure', () => {
    it('4.2 for loop with done-port continuation (after-loop action outside body)', async () => {
      const { graph, ids } = buildLoopWithBody({
        graphId: 'for-done',
        loopType: 'for',
        iteratorVariable: 'j',
        iterableExpression: '1,5',
        withDoneContinuation: true,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Loop header present
      expect(lua).toContain('for j = 1, 5 do')

      // Body action present and inside loop
      expectDeeper(lua, 'for j = 1, 5 do', 'vim.opt.body_opt1 = true')

      // After-loop action present with correct value
      expectAssignment(lua, 'vim.opt.after_loop_opt', 'true')

      // Verify complete structure: loop body inside, after-loop outside
      expectInOrder(lua, [
        'for j = 1, 5 do',
        'vim.opt.body_opt1 = true',
        'end',
        'vim.opt.after_loop_opt = true',
      ])

      // After-loop action NOT inside the loop body (should have same or less indent)
      const lines = lua.split('\n')
      const loopHeaderLine = lines.find((l) => l.includes('for j = 1, 5 do'))
      const afterLoopLine = lines.find((l) =>
        l.includes('vim.opt.after_loop_opt'),
      )
      if (loopHeaderLine !== undefined && afterLoopLine !== undefined) {
        const headerIndent = loopHeaderLine.match(/^(\s*)/)?.[1]?.length ?? 0
        const afterIndent = afterLoopLine.match(/^(\s*)/)?.[1]?.length ?? 0
        expect(afterIndent).toBeLessThanOrEqual(headerIndent)
      }

      // Negative: wrong value
      expectNoOccurrence(lua, 'vim.opt.after_loop_opt = false')

      expect(ids.doneId).toBe('for-done-after')

      await assertLuaSyntaxValid(lua)
    })

    it('4.5 loop with multi-node body chain', async () => {
      const { graph } = buildLoopWithBody({
        graphId: 'for-multi-body',
        loopType: 'for',
        iteratorVariable: 'k',
        iterableExpression: '1,3',
        bodyLength: 3,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // All body nodes emitted in order with correct values
      const bodyStatements = [
        'vim.opt.body_opt1 = true',
        'vim.opt.body_opt2 = true',
        'vim.opt.body_opt3 = true',
      ]
      expectContainsAll(lua, bodyStatements)
      expectInOrder(lua, bodyStatements)

      // All inside loop body
      for (const stmt of bodyStatements) {
        expectDeeper(lua, 'for k = 1, 3 do', stmt)
      }

      // Each appears exactly once
      for (const stmt of bodyStatements) {
        expectOccursExactly(lua, stmt, 1)
      }

      await assertLuaSyntaxValid(lua)
    })

    it('4.10 for loop with complete-port continuation (alias path)', async () => {
      // Uses raw builder.connect(loopId, afterId, 'complete', 'exec')
      // to exercise the 'complete' alias branch in exec-traversal.ts:288.
      // Asserts same post-loop structure as test 4.2.
      const { graph, ids } = buildLoopWithBody({
        graphId: 'for-complete',
        loopType: 'for',
        iteratorVariable: 'm',
        iterableExpression: '1,7',
        withCompleteContinuation: true,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Loop header present
      expect(lua).toContain('for m = 1, 7 do')

      // Body action present and inside loop
      expect(lua).toContain('vim.opt.body_opt1')
      expectDeeper(lua, 'for m = 1, 7 do', 'vim.opt.body_opt1')

      // After-loop action present — must appear after loop ends
      expect(lua).toContain('vim.opt.after_loop_opt')
      expectInOrder(lua, ['end', 'vim.opt.after_loop_opt'])

      expect(ids.doneId).toBe('for-complete-after')

      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Nested / mixed control flow
  // ───────────────────────────────────────────────────────────────────────────

  describe('nested/mixed control flow', () => {
    it('4.6 nested loops (for inside for)', async () => {
      // Build: Startup → OuterFor →(loop)→ InnerFor →(loop)→ BodyAction
      const graph = new GraphBuilder('nested-for', 'nested-for')
        .startupTrigger('trigger')
        .loop('outer-loop', 'for', 'i', '1,3')
        .loop('inner-loop', 'for', 'j', '1,5')
        .action('body-act', 'set-option', setOptionConfig('nested_body'))
        .connectExec('trigger', 'outer-loop')
        .connectLoopBody('outer-loop', 'inner-loop')
        .connectLoopBody('inner-loop', 'body-act')
        .build()

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Both loop headers present
      expectContainsAll(lua, ['for i = 1, 3 do', 'for j = 1, 5 do'])

      // Inner loop is inside outer loop
      expectDeeper(lua, 'for i = 1, 3 do', 'for j = 1, 5 do')

      // Body is inside inner loop
      expectDeeper(lua, 'for j = 1, 5 do', 'vim.opt.nested_body')

      // At least 2 levels of loop nesting
      expectNestingDepth(lua, { loopDepth: 2 })

      await assertLuaSyntaxValid(lua)
    })

    it('4.7 loop with condition inside body (if inside for)', async () => {
      // Build: Startup → For →(loop)→ Condition →(true)→ BodyAction
      const graph = new GraphBuilder('for-with-cond', 'for-with-cond')
        .startupTrigger('trigger')
        .loop('loop', 'for', 'n', '1,10')
        .condition('cond', '>', 'n', '5')
        .action('cond-true-act', 'run-action', runCommandConfig('echo n_gt_5'))
        .connectExec('trigger', 'loop')
        .connectLoopBody('loop', 'cond')
        .connectTrue('cond', 'cond-true-act')
        .build()

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Loop header and condition header present
      expectContainsAll(lua, ['for n = 1, 10 do', 'if n > 5 then'])

      // Condition is inside loop body
      expectDeeper(lua, 'for n = 1, 10 do', 'if n > 5 then')

      // Action is inside condition
      expect(lua).toContain('echo n_gt_5')
      expectDeeper(lua, 'if n > 5 then', 'echo n_gt_5')

      await assertLuaSyntaxValid(lua)
    })

    it('4.8 loop followed by continuation chain (AfterAction1 -> AfterAction2)', async () => {
      // Build: Startup → For →(done)→ After1 →(done)→ After2
      const graph = new GraphBuilder('for-post-chain', 'for-post-chain')
        .startupTrigger('trigger')
        .loop('loop', 'for', 'x', '1,4')
        .action('body', 'set-option', setOptionConfig('loop_body_opt'))
        .action('after1', 'run-action', runCommandConfig('echo after_1'))
        .action('after2', 'run-action', runCommandConfig('echo after_2'))
        .connectExec('trigger', 'loop')
        .connectLoopBody('loop', 'body')
        .connectLoopComplete('loop', 'after1')
        .connectExec('after1', 'after2')
        .build()

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Loop and body present
      expect(lua).toContain('for x = 1, 4 do')
      expect(lua).toContain('vim.opt.loop_body_opt')

      // Post-loop continuation chain in order, after loop
      expectContainsAll(lua, ['echo after_1', 'echo after_2'])
      expectInOrder(lua, ['end', 'echo after_1', 'echo after_2'])

      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Loop data binding
  // ───────────────────────────────────────────────────────────────────────────

  describe('loop data binding', () => {
    it('4.9 each loop data output (item port available in generated output)', async () => {
      // Build: Startup → Each(item, my_table) →(loop)→ BodyAction
      // The each loop generator exposes the item variable in the body context.
      // We assert:
      //   1. The correct each-loop header is generated.
      //   2. The loop body action is nested inside the loop.
      //   3. Syntax is valid (item variable is in scope inside the loop).
      const graph = new GraphBuilder('each-data', 'each-data')
        .startupTrigger('trigger')
        .loop('each-loop', 'each', 'item', 'config_list')
        .action('body', 'set-option', setOptionConfig('each_body'))
        .connectExec('trigger', 'each-loop')
        .connectLoopBody('each-loop', 'body')
        .build()

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Each loop header uses pairs() wrapping the raw iterable
      expect(lua).toContain('for _, item in pairs(config_list) do')

      // Body is inside loop with correct value
      expectAssignment(lua, 'vim.opt.each_body', 'true')
      expectDeeper(
        lua,
        'for _, item in pairs(config_list) do',
        'vim.opt.each_body = true',
      )

      // Verify complete loop structure
      expectInOrder(lua, [
        'for _, item in pairs(config_list) do',
        'vim.opt.each_body = true',
        'end',
      ])

      // Negative: no double-wrapping of pairs
      expectNoOccurrence(lua, 'pairs(pairs(')
      // Negative: each uses pairs, not ipairs
      expectNoOccurrence(lua, 'ipairs(config_list)')

      // Syntax valid — item variable is in scope
      await assertLuaSyntaxValid(lua)
    })
  })
})
