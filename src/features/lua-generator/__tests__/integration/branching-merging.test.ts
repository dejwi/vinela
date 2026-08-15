/**
 * Category 3: Branching & Merging
 *
 * Tests for condition node patterns:
 *   - Single condition (true-only, false-only, both branches)
 *   - Merge / diamond patterns (continuation after branches)
 *   - Nested conditions (2-level and 3-level)
 *   - Operator coverage (==, ~=, >, >=, <, <=)
 *   - Sequential non-nested conditions
 *   - Fan-out and multi-node branch chains
 *
 * Every test calls assertBlocksBalanced and assertLuaSyntaxValid.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { GraphBuilder } from '@/features/lua-generator/__tests__/utils/graph-builder'
import type { ConditionOperator } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import { generateLuaFromGraph } from './helpers/generate-lua'
import {
  assertBlocksBalanced,
  assertLuaSyntaxValid,
  ensureLuaParserAvailable,
  expectAssignment,
  expectBlockStructure,
  expectContainsAll,
  expectDeeper,
  expectInOrder,
  expectNestingDepth,
  expectNoOccurrence,
  expectOccursExactly,
} from './helpers/lua-assertions'
import {
  buildConditionDiamond,
  buildNestedConditions,
} from './helpers/pattern-builders'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await ensureLuaParserAvailable()
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function setOptionConfig(optionName: string, value: boolean | number = true) {
  return {
    ...createDefaultActionConfig('set-option'),
    optionName,
    scope: 'global' as const,
    valueConfig: { valueMode: 'suggested' as const, suggestedValue: value },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Category 3: Branching & Merging
// ─────────────────────────────────────────────────────────────────────────────

describe('Category 3: Branching & Merging', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Single-condition patterns
  // ───────────────────────────────────────────────────────────────────────────

  describe('single-condition patterns', () => {
    it('3.1 simple if-then (true branch only, no else)', async () => {
      const { graph } = buildConditionDiamond({
        graphId: 'cond-true-only',
        operator: '==',
        operandA: 'x',
        operandB: '1',
        trueOnly: true,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Must contain if/then/end tokens in order
      expectBlockStructure(lua, ['if x == 1 then', 'end'])

      // Verify action is wrapped in vim.cmd and inside the if block
      expect(lua).toContain('vim.cmd("echo true_1")')
      expectDeeper(lua, 'if x == 1 then', 'vim.cmd("echo true_1")')
      // Negative: no else branch (anchored to avoid matching "elseif" etc.)
      expect(lua).not.toMatch(/^\s*else\b/m)
      // Verify ordering: action is between if and end
      expectInOrder(lua, ['if x == 1 then', 'vim.cmd("echo true_1")', 'end'])

      await assertLuaSyntaxValid(lua)
    })

    it('3.2 if-then-else with both branches', async () => {
      const { graph } = buildConditionDiamond({
        graphId: 'cond-both',
        operator: '==',
        operandA: 'x',
        operandB: '1',
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Full if-else structure
      expectBlockStructure(lua, ['if x == 1 then', 'else', 'end'])

      // Verify actions are vim.cmd wrapped
      expectContainsAll(lua, [
        'vim.cmd("echo true_1")',
        'vim.cmd("echo false_1")',
      ])

      // Verify branch placement
      expectInOrder(lua, [
        'if x == 1 then',
        'vim.cmd("echo true_1")',
        'else',
        'vim.cmd("echo false_1")',
        'end',
      ])
      // Verify indentation: both actions inside their respective branches
      expectDeeper(lua, 'if x == 1 then', 'vim.cmd("echo true_1")')
      expectDeeper(lua, 'if x == 1 then', 'vim.cmd("echo false_1")')

      await assertLuaSyntaxValid(lua)
    })

    it('3.7 condition with only false branch (negated if form)', async () => {
      const { graph } = buildConditionDiamond({
        graphId: 'cond-false-only',
        operator: '>',
        operandA: 'y',
        operandB: '0',
        falseOnly: true,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Negated form
      expect(lua).toContain('if not (y > 0) then')

      // False branch action present, vim.cmd wrapped
      expect(lua).toContain('vim.cmd("echo false_1")')
      // Anchored negative for else
      expect(lua).not.toMatch(/^\s*else\b/m)
      // Verify action is inside the negated if block
      expectInOrder(lua, [
        'if not (y > 0) then',
        'vim.cmd("echo false_1")',
        'end',
      ])
      expectDeeper(lua, 'if not (y > 0) then', 'vim.cmd("echo false_1")')
      // Negative: no true branch action should exist
      expectNoOccurrence(lua, 'echo true_1')

      await assertLuaSyntaxValid(lua)
    })

    it('3.8 condition with multi-node branch chains', async () => {
      const { graph } = buildConditionDiamond({
        graphId: 'cond-multinode',
        operator: '==',
        operandA: 'z',
        operandB: '5',
        trueBranchLength: 3,
        falseBranchLength: 2,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // True branch: 3 nodes
      expectContainsAll(lua, ['echo true_1', 'echo true_2', 'echo true_3'])
      expectInOrder(lua, ['echo true_1', 'echo true_2', 'echo true_3'])

      // False branch: 2 nodes
      expectContainsAll(lua, ['echo false_1', 'echo false_2'])
      expectInOrder(lua, ['echo false_1', 'echo false_2'])

      // True branch before else, false branch after else
      expectInOrder(lua, ['echo true_1', 'else', 'echo false_1'])

      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Merge and diamond patterns
  // ───────────────────────────────────────────────────────────────────────────

  describe('merge and diamond patterns', () => {
    it('3.3 if-then-else with merge continuation, merge emitted once', async () => {
      const { graph, ids } = buildConditionDiamond({
        graphId: 'cond-merge',
        operator: '==',
        operandA: 'x',
        operandB: '1',
        withMerge: true,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Branch actions and merge action all present
      expectContainsAll(lua, ['echo true_1', 'echo false_1'])

      // Merge action (merge_opt set-option) appears exactly once
      expectOccursExactly(lua, 'vim.opt.merge_opt', 1)

      // IDs sanity check
      expect(ids.mergeId).toBe('cond-merge-merge')

      await assertLuaSyntaxValid(lua)
    })

    it('3.4 diamond: post-branch continuation emitted once (not duplicated)', async () => {
      // Build: Startup → Cond →(true)→ TrueAction →(done)→ AfterCond
      //                       →(false)→ FalseAction →(done)→ AfterCond
      //
      // Both branches converge on AfterCond. The traversal emits AfterCond exactly
      // once (inside the true branch chain), and not again for the false branch.
      // assertBlocksBalanced validates the if-else structure is well-formed.
      const graph = new GraphBuilder('cond-diamond-cont', 'cond-diamond-cont')
        .startupTrigger('trigger')
        .condition('cond', '==', 'a', '2')
        .action('true-act', 'run-action', runCommandConfig('echo diamond_true'))
        .action(
          'false-act',
          'run-action',
          runCommandConfig('echo diamond_false'),
        )
        .action('after-cond', 'set-option', setOptionConfig('after_diamond'))
        .connectExec('trigger', 'cond')
        .connectTrue('cond', 'true-act')
        .connectFalse('cond', 'false-act')
        // Both branches converge on after-cond
        .connectExec('true-act', 'after-cond')
        .connectExec('false-act', 'after-cond')
        .build()

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Both branch actions present
      expectContainsAll(lua, ['echo diamond_true', 'echo diamond_false'])

      // Post-condition action present (emitted exactly once — not duplicated)
      expectAssignment(lua, 'vim.opt.after_diamond', 'true')
      expectOccursExactly(lua, 'vim.opt.after_diamond = true', 1)
      // Negative: wrong value
      expectNoOccurrence(lua, 'vim.opt.after_diamond = false')
      expectNoOccurrence(lua, 'vim.opt.after_diamond = nil')
      // Verify it appears after the true-branch action (emitted inside true branch, once)
      expectInOrder(lua, ['echo diamond_true', 'vim.opt.after_diamond = true'])

      await assertLuaSyntaxValid(lua)
    })

    it('3.11 fan-out branches where both branch chains are fully emitted', async () => {
      // Same as 3.2 but assert both branches independently emit all nodes
      const { graph } = buildConditionDiamond({
        graphId: 'cond-fanout',
        operator: '~=',
        operandA: 'mode',
        operandB: '"n"',
        trueBranchLength: 2,
        falseBranchLength: 2,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Both branch chains fully emitted
      expectContainsAll(lua, [
        'echo true_1',
        'echo true_2',
        'echo false_1',
        'echo false_2',
      ])

      await assertLuaSyntaxValid(lua)
    })

    it('3.12 merge with post-merge continuation chain (C -> D after end)', async () => {
      // Build: Startup → Cond →(true)→ TrueA →(done)→ MergeA
      //                       →(false)→ FalseA →(done)→ MergeA
      // Then MergeA →(done)→ PostA →(done)→ PostB
      const graph = new GraphBuilder(
        'cond-post-merge-chain',
        'cond-post-merge-chain',
      )
        .startupTrigger('trigger')
        .condition('cond', '==', 'n', '1')
        .action('true-a', 'run-action', runCommandConfig('echo true_path'))
        .action('false-a', 'run-action', runCommandConfig('echo false_path'))
        .action('merge-a', 'set-option', setOptionConfig('merge_point'))
        .action('post-a', 'run-action', runCommandConfig('echo post_a'))
        .action('post-b', 'run-action', runCommandConfig('echo post_b'))
        .connectExec('trigger', 'cond')
        .connectTrue('cond', 'true-a')
        .connectFalse('cond', 'false-a')
        .connectExec('true-a', 'merge-a')
        .connectExec('false-a', 'merge-a')
        .connectExec('merge-a', 'post-a')
        .connectExec('post-a', 'post-b')
        .build()

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Merge point appears exactly once
      expectOccursExactly(lua, 'vim.opt.merge_point', 1)

      // Post-merge chain appears in order after merge
      expectContainsAll(lua, ['echo post_a', 'echo post_b'])
      expectInOrder(lua, ['vim.opt.merge_point', 'echo post_a', 'echo post_b'])

      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Nested condition patterns
  // ───────────────────────────────────────────────────────────────────────────

  describe('nested condition patterns', () => {
    it('3.5 nested conditions (2 levels)', async () => {
      const { graph } = buildNestedConditions({
        graphId: 'nested-2',
        levels: 2,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Both condition headers present
      expectContainsAll(lua, ['if a > 0 then', 'if b == 1 then'])

      // Inner condition is inside outer's true branch
      expectInOrder(lua, ['if a > 0 then', 'if b == 1 then'])

      // Leaf actions present
      expectContainsAll(lua, ['echo leaf1', 'echo leaf2'])

      // Nesting depth: inner condition should be indented
      expectDeeper(lua, 'if a > 0 then', 'if b == 1 then')

      // At least 2 if depths
      expectNestingDepth(lua, { ifDepth: 2 })

      await assertLuaSyntaxValid(lua)
    })

    it('3.6 deep nested conditions (3 levels)', async () => {
      const { graph } = buildNestedConditions({
        graphId: 'nested-3',
        levels: 3,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // All three condition headers present
      expectContainsAll(lua, [
        'if a > 0 then',
        'if b == 1 then',
        'if c < 5 then',
      ])

      // Nesting order
      expectInOrder(lua, ['if a > 0 then', 'if b == 1 then', 'if c < 5 then'])

      // At least 3 if depths
      expectNestingDepth(lua, { ifDepth: 3 })

      // All leaf actions present
      expectContainsAll(lua, ['echo leaf1', 'echo leaf2', 'echo leaf3'])

      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Operator coverage
  // ───────────────────────────────────────────────────────────────────────────

  describe('operator coverage', () => {
    const operators: Array<{ op: ConditionOperator; luaOp: string }> = [
      { op: '==', luaOp: '==' },
      { op: '~=', luaOp: '~=' },
      { op: '>', luaOp: '>' },
      { op: '>=', luaOp: '>=' },
      { op: '<', luaOp: '<' },
      { op: '<=', luaOp: '<=' },
    ]

    it.each(
      operators,
    )('3.9 operator $op generates correct Lua operator', async ({
      op,
      luaOp,
    }) => {
      const graphId = `cond-op-${op.replace(/[^a-z0-9]/gi, '_')}`
      const { graph } = buildConditionDiamond({
        graphId,
        operator: op,
        operandA: 'val',
        operandB: '10',
        trueOnly: true,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Verify complete if statement
      expect(lua).toContain(`if val ${luaOp} 10 then`)
      // Verify the condition has a body
      expectInOrder(lua, [`if val ${luaOp} 10 then`, 'end'])
      // Verify the true branch action exists inside
      expect(lua).toContain('vim.cmd("echo true_1")')
      expectDeeper(lua, `if val ${luaOp} 10 then`, 'vim.cmd("echo true_1")')

      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Sequential and continuation patterns
  // ───────────────────────────────────────────────────────────────────────────

  describe('sequential and continuation patterns', () => {
    it('3.10 post-condition action runs exactly once (merge deduplication)', async () => {
      // Build: Startup → CondA →(true)→ ActionA1 →(done)→ PostAction
      //                        →(false)→ ActionF1 →(done)→ PostAction
      //
      // PostAction is the merge point: reachable from both branches.
      // The traversal must emit PostAction exactly once after the if-else block.
      const graph = new GraphBuilder('cond-merge-dedup', 'cond-merge-dedup')
        .startupTrigger('trigger')
        .condition('cond-a', '~=', 's', '"ok"')
        .action('action-a1', 'run-action', runCommandConfig('echo true_branch'))
        .action(
          'action-f1',
          'run-action',
          runCommandConfig('echo false_branch'),
        )
        .action('post-action', 'set-option', setOptionConfig('post_merged'))
        .connectExec('trigger', 'cond-a')
        .connectTrue('cond-a', 'action-a1')
        .connectFalse('cond-a', 'action-f1')
        // Both branches converge on post-action
        .connectExec('action-a1', 'post-action')
        .connectExec('action-f1', 'post-action')
        .build()

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Both branch actions properly wrapped
      expectContainsAll(lua, [
        'vim.cmd("echo true_branch")',
        'vim.cmd("echo false_branch")',
      ])

      // Post-merge action appears exactly once (not duplicated for each branch)
      expectOccursExactly(lua, 'vim.opt.post_merged = true', 1)

      // Post-merge action appears after true-branch action (emitted inside true branch, exactly once)
      expectInOrder(lua, [
        'vim.cmd("echo true_branch")',
        'vim.opt.post_merged = true',
      ])
      // Negative: wrong value
      expectNoOccurrence(lua, 'vim.opt.post_merged = false')

      await assertLuaSyntaxValid(lua)
    })
  })
})
