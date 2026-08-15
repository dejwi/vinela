/**
 * Category 2: Linear Chains
 *
 * Tests for Startup → A₁ → A₂ → … → Aₙ execution chains.
 * Covers: minimal 2-node regression, 3- and 5-node sequences, mixed action
 * types, code-block nodes, builtin nodes, a 10-node long chain, and a callable
 * chain ending in a Return node.
 *
 * Every test calls assertBlocksBalanced and assertLuaSyntaxValid.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { expectedCallableRef } from '@/features/lua-generator/__tests__/utils/callable-keys'
import { GraphBuilder } from '@/features/lua-generator/__tests__/utils/graph-builder'
import { createDefaultActionConfig } from '@/shared/types'
import {
  generateLuaFromGraph,
  generateLuaFromGraphs,
} from './helpers/generate-lua'
import {
  assertBlocksBalanced,
  assertLuaSyntaxValid,
  ensureLuaParserAvailable,
  expectContainsAll,
  expectDeeper,
  expectInOrder,
  expectNoOccurrence,
  expectOccursExactly,
} from './helpers/lua-assertions'
import {
  buildLinearCallableChain,
  buildLinearStartupChain,
} from './helpers/pattern-builders'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await ensureLuaParserAvailable()
})

// ─────────────────────────────────────────────────────────────────────────────
// Fixed-length action chains
// ─────────────────────────────────────────────────────────────────────────────

describe('Category 2: Linear Chains', () => {
  describe('fixed-length action chains', () => {
    it('2.1 two actions in sequence (minimal regression reproducer)', async () => {
      const { graph } = buildLinearStartupChain({
        graphId: 'chain-two',
        length: 2,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)
      expectContainsAll(lua, ['vim.opt.opt1 = true', 'vim.opt.opt2 = true'])
      expectInOrder(lua, ['vim.opt.opt1 = true', 'vim.opt.opt2 = true'])
      await assertLuaSyntaxValid(lua)
    })

    it('2.2 three actions in sequence', async () => {
      const { graph } = buildLinearStartupChain({
        graphId: 'chain-three',
        length: 3,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)
      expectContainsAll(lua, [
        'vim.opt.opt1 = true',
        'vim.opt.opt2 = true',
        'vim.opt.opt3 = true',
      ])
      expectInOrder(lua, [
        'vim.opt.opt1 = true',
        'vim.opt.opt2 = true',
        'vim.opt.opt3 = true',
      ])
      await assertLuaSyntaxValid(lua)
    })

    it('2.3 five actions in sequence', async () => {
      const { graph } = buildLinearStartupChain({
        graphId: 'chain-five',
        length: 5,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)
      const expectedStatements = Array.from(
        { length: 5 },
        (_, i) => `vim.opt.opt${i + 1} = true`,
      )
      expectContainsAll(lua, expectedStatements)
      expectInOrder(lua, expectedStatements)
      // Verify each appears exactly once
      for (const stmt of expectedStatements) {
        expectOccursExactly(lua, stmt, 1)
      }
      // Negative: no option should have wrong value
      for (let i = 1; i <= 5; i++) {
        expectNoOccurrence(lua, `vim.opt.opt${i} = false`)
        expectNoOccurrence(lua, `vim.opt.opt${i} = nil`)
      }
      await assertLuaSyntaxValid(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Mixed chain node types
  // ─────────────────────────────────────────────────────────────────────────

  describe('mixed chain node types', () => {
    it('2.4 mixed action types in sequence', async () => {
      // set-option → set-variable → run-action
      const graph = new GraphBuilder('mixed-chain', 'mixed-chain')
        .startupTrigger('trigger')
        .action('opt-action', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        })
        .action('var-action', 'set-variable', {
          ...createDefaultActionConfig('set-variable'),
          scope: 'g',
          variableName: 'my_flag',
          valueType: 'boolean',
          value: true,
        })
        .action('run-action', 'run-action', {
          ...createDefaultActionConfig('run-action'),
          mode: 'custom-command',
          actionType: 'command',
          action: 'echo mixed',
          selectedActionKey: '',
          paramValues: {},
        })
        .connectExec('trigger', 'opt-action')
        .connectExec('opt-action', 'var-action')
        .connectExec('var-action', 'run-action')
        .build()

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)
      expectContainsAll(lua, [
        'vim.opt.number = true',
        'vim.g.my_flag = true',
        'vim.cmd("echo mixed")',
      ])
      expectInOrder(lua, [
        'vim.opt.number = true',
        'vim.g.my_flag = true',
        'vim.cmd("echo mixed")',
      ])
      await assertLuaSyntaxValid(lua)
    })

    it('2.5 chain with code block in middle', async () => {
      const graph = new GraphBuilder('code-block-chain', 'code-block-chain')
        .startupTrigger('trigger')
        .action('before', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'wrap',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: false },
        })
        .codeBlock('code', 'local x = 42\nreturn x')
        .action('after', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        })
        .connectExec('trigger', 'before')
        .connectExec('before', 'code')
        .connectExec('code', 'after')
        .build()

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      // code-block with return but no outputs emits a missing-return warning
      // (it has no output ports declared) — that is expected
      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)
      expectContainsAll(lua, [
        'vim.opt.wrap = false',
        'local x = 42',
        'vim.opt.number = true',
      ])
      expectInOrder(lua, [
        'vim.opt.wrap = false',
        'local x = 42',
        'vim.opt.number = true',
      ])
      await assertLuaSyntaxValid(lua)
    })

    it('2.6 chain including builtin nodes', async () => {
      const graph = new GraphBuilder('builtin-chain', 'builtin-chain')
        .startupTrigger('trigger')
        .action('opt', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'termguicolors',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        })
        .builtin('notify', 'ui.notify', {
          message: 'Config loaded',
          level: 'info',
        })
        .action('after', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        })
        .connectExec('trigger', 'opt')
        .connectExec('opt', 'notify')
        .connectExec('notify', 'after')
        .build()

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)
      expectContainsAll(lua, [
        'vim.opt.termguicolors = true',
        'vim.notify("Config loaded"',
        'vim.log.levels.INFO',
        'vim.opt.number = true',
      ])
      expectInOrder(lua, [
        'vim.opt.termguicolors = true',
        'vim.notify("Config loaded"',
        'vim.opt.number = true',
      ])
      // Negative: wrong option values
      expectNoOccurrence(lua, 'vim.opt.termguicolors = false')
      expectNoOccurrence(lua, 'vim.opt.number = false')
      await assertLuaSyntaxValid(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Long-chain integrity
  // ─────────────────────────────────────────────────────────────────────────

  describe('long-chain integrity', () => {
    it('2.7 long chain of ten nodes (presence + order + no duplicates)', async () => {
      const { graph } = buildLinearStartupChain({
        graphId: 'chain-ten',
        length: 10,
      })

      const { lua, diagnostics } = generateLuaFromGraph(graph)

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // All 10 assignments must be present
      const expectedSnippets = Array.from(
        { length: 10 },
        (_, i) => `vim.opt.opt${i + 1} = true`,
      )
      expectContainsAll(lua, expectedSnippets)

      // Must appear in order
      expectInOrder(lua, expectedSnippets)

      // Each assignment must appear exactly once (no duplicate emission)
      for (const snippet of expectedSnippets) {
        expectOccursExactly(lua, snippet, 1)
      }

      await assertLuaSyntaxValid(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Callable chain ending in return
  // ─────────────────────────────────────────────────────────────────────────

  describe('callable chain ending in return', () => {
    it('2.8 callable chain ending in return (function structure + body order)', async () => {
      const { graph, ids } = buildLinearCallableChain({
        graphId: 'callable-chain',
        length: 2,
      })

      const { lua, diagnostics } = generateLuaFromGraphs([graph])

      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)

      // Verify callable registration is an assignment
      expect(lua).toContain(
        `${expectedCallableRef('callable-chain', 'callable-chain')} = function(params)`,
      )
      expectContainsAll(lua, ['vim.opt.opt1 = true', 'vim.opt.opt2 = true'])
      // Return must appear after body actions
      expectInOrder(lua, [
        'vim.opt.opt1 = true',
        'vim.opt.opt2 = true',
        'return {',
      ])
      // Verify the return is inside the function body (indented)
      expectDeeper(lua, '_G._vinela_callables', 'return {')
      // Negative: options should not have wrong values
      expectNoOccurrence(lua, 'vim.opt.opt1 = false')
      expectNoOccurrence(lua, 'vim.opt.opt2 = false')

      // IDs are present (suppress TS unused-variable hint)
      expect(ids.entryId).toBe('callable-chain-entry')
      expect(ids.returnId).toBe('callable-chain-return')

      await assertLuaSyntaxValid(lua)
    })
  })
})
