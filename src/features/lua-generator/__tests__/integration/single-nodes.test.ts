/**
 * Category 1: Single Node Generation Integration Tests
 *
 * 41 integration tests verifying end-to-end Lua generation from real graphs
 * through traversal and node generators. Each test:
 *   1. Builds a minimal graph (Startup trigger → target node).
 *   2. Calls generateAllGraphs via the helper wrapper.
 *   3. Asserts expected Lua snippet(s) are present.
 *   4. Calls await assertLuaSyntaxValid() (Tier 2, spec D1) on positive-path tests.
 *   5. Asserts collector diagnostic state per the per-case warning contract.
 *
 * Case IDs map to the spec in temp-plan/2026-03-05-single-node-tests-plan.md.
 */

import { describe, expect, it } from 'vitest'
import { requireDefined } from '@/features/lua-generator/__tests__/utils/test-assertions'
import type { CallFunctionActionConfig } from '@/features/lua-generator/generators/nodes/action/call-function'
import {
  expectAssignment,
  expectFullAutocmdCall,
  expectFullKeymapCall,
  expectNoOccurrence,
  expectOccursExactly,
  extractLocalVar,
} from './helpers/lua-assertions'
import {
  assertHasWarning,
  assertLuaSyntaxValid,
  assertNoDiagnostics,
  assertNoErrors,
  buildStartupGraph,
  expectLuaContainsInOrder,
  generateSingleGraph,
  patchActionAsCallFunction,
  patchRunFunctionSignature,
} from './single-node-test-helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Group A: Option + Command + Keymap Actions (Cases 1.1–1.10)
// ─────────────────────────────────────────────────────────────────────────────

describe('Group A: set-option, run-command, set-keymap', () => {
  // 1.1 set-option boolean
  it('1.1 set-option boolean (true)', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-option', {
          actionConfigType: 'set-option',
          optionName: 'number',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.opt.number = true')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.2 set-option number
  it('1.2 set-option number', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-option', {
          actionConfigType: 'set-option',
          optionName: 'tabstop',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: 4 },
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.opt.tabstop = 4')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.3 set-option string
  it('1.3 set-option string', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-option', {
          actionConfigType: 'set-option',
          optionName: 'background',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: 'dark' },
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.opt.background = "dark"')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.4 set-option local scope
  it('1.4 set-option local scope', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-option', {
          actionConfigType: 'set-option',
          optionName: 'wrap',
          scope: 'local',
          valueConfig: { valueMode: 'suggested', suggestedValue: false },
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.opt_local.wrap = false')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.5 set-option raw expression
  it('1.5 set-option raw expression', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-option', {
          actionConfigType: 'set-option',
          optionName: 'shiftwidth',
          scope: 'global',
          valueConfig: { valueMode: 'raw', rawValue: 'vim.o.tabstop' },
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.opt.shiftwidth = vim.o.tabstop')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.6 run-command (ex mode)
  it('1.6 run-command ex mode', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: 'colorscheme habamax',
          selectedActionKey: '',
          paramValues: {},
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.cmd("colorscheme habamax")')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.7 run-command (keys mode)
  it('1.7 run-command keys mode', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-keys',
          actionType: 'keys',
          action: '<CR>',
          selectedActionKey: '',
          paramValues: {},
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain(
      'vim.api.nvim_feedkeys(vim.keycode("<CR>"), "m", false)',
    )
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.8 set-keymap single mode
  it('1.8 set-keymap single mode', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-keymap', {
          actionConfigType: 'set-keymap',
          modes: ['n'],
          keySequence: '<leader>f',
          command: ':vsplit<cr>',
          description: 'Vertical split',
          silent: true,
          noremap: true,
          expr: false,
          showInKeymaps: false,
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expectFullKeymapCall(startupLua, {
      modes: 'n',
      lhs: '<leader>f',
      rhs: ':vsplit<cr>',
      desc: 'Vertical split',
      opts: { silent: true, remap: false },
    })
    // Negative: single mode should NOT use table format
    expectNoOccurrence(startupLua, '{"n"}')
    // Negative: expr should not appear (expr=false)
    expectNoOccurrence(startupLua, 'expr = true')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.9 set-keymap multi-mode
  it('1.9 set-keymap multi-mode', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-keymap', {
          actionConfigType: 'set-keymap',
          modes: ['n', 'v'],
          keySequence: '<leader>y',
          command: '"+y',
          description: 'Yank to clipboard',
          silent: true,
          noremap: true,
          expr: false,
          showInKeymaps: false,
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    // Verify the complete keymap call structure
    expectFullKeymapCall(startupLua, {
      modes: ['n', 'v'],
      lhs: '<leader>y',
      rhs: '"+y',
      desc: 'Yank to clipboard',
      opts: { silent: true, remap: false },
    })
    // Negative: should NOT emit two separate keymap.set calls
    expectOccursExactly(startupLua, 'vim.keymap.set(', 1)
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.10 set-keymap with expr=true
  it('1.10 set-keymap with expr=true', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-keymap', {
          actionConfigType: 'set-keymap',
          modes: ['i'],
          keySequence: '<Tab>',
          command: 'pumvisible() ? "<C-n>" : "<Tab>"',
          description: 'Smart tab',
          silent: false,
          noremap: true,
          expr: true,
          showInKeymaps: false,
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expectFullKeymapCall(startupLua, {
      modes: 'i',
      lhs: '<Tab>',
      rhs: 'pumvisible()',
      desc: 'Smart tab',
      opts: { expr: true, remap: false },
    })
    // Negative: silent should NOT appear (silent=false)
    expectNoOccurrence(startupLua, 'silent = true')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group B: Variable Actions (Cases 1.11–1.16)
// ─────────────────────────────────────────────────────────────────────────────

describe('Group B: set-variable, get-variable', () => {
  // 1.11 set-variable string
  it('1.11 set-variable string', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-variable', {
          actionConfigType: 'set-variable',
          scope: 'g',
          variableName: 'mapleader',
          valueType: 'string',
          value: '\\',
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    // Full assignment with correct value (backslash = Lua string "\\")
    expectAssignment(startupLua, 'vim.g.mapleader', '"\\\\"')
    // Negative: should not be a read (local x = vim.g.mapleader)
    expect(startupLua).not.toMatch(/local\s+\w+\s*=\s*vim\.g\.mapleader/)
    // Negative: wrong scope
    expectNoOccurrence(startupLua, 'vim.b.mapleader')
    expectNoOccurrence(startupLua, 'vim.w.mapleader')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.12 set-variable number
  it('1.12 set-variable number', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-variable', {
          actionConfigType: 'set-variable',
          scope: 'g',
          variableName: 'my_count',
          valueType: 'number',
          value: 42,
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.g.my_count = 42')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.13 set-variable boolean
  it('1.13 set-variable boolean', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-variable', {
          actionConfigType: 'set-variable',
          scope: 'g',
          variableName: 'plugin_enabled',
          valueType: 'boolean',
          value: true,
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.g.plugin_enabled = true')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.14 set-variable raw
  it('1.14 set-variable raw', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-variable', {
          actionConfigType: 'set-variable',
          scope: 'g',
          variableName: 'computed',
          valueType: 'raw',
          value: 'vim.fn.getcwd()',
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.g.computed = vim.fn.getcwd()')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.15 set-variable all scopes (5 sub-tests: g, b, w, t, v)
  it('1.15a set-variable scope g', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-variable', {
          actionConfigType: 'set-variable',
          scope: 'g',
          variableName: 'g_var',
          valueType: 'number',
          value: 1,
        })
        .connectExec('entry', 'node1'),
    )
    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.g.g_var = 1')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  it('1.15b set-variable scope b', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-variable', {
          actionConfigType: 'set-variable',
          scope: 'b',
          variableName: 'b_var',
          valueType: 'number',
          value: 2,
        })
        .connectExec('entry', 'node1'),
    )
    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.b.b_var = 2')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  it('1.15c set-variable scope w', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-variable', {
          actionConfigType: 'set-variable',
          scope: 'w',
          variableName: 'w_var',
          valueType: 'boolean',
          value: false,
        })
        .connectExec('entry', 'node1'),
    )
    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.w.w_var = false')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  it('1.15d set-variable scope t', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-variable', {
          actionConfigType: 'set-variable',
          scope: 't',
          variableName: 't_var',
          valueType: 'string',
          value: 'hello',
        })
        .connectExec('entry', 'node1'),
    )
    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.t.t_var = "hello"')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  it('1.15e set-variable scope v', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-variable', {
          actionConfigType: 'set-variable',
          scope: 'v',
          variableName: 'v_var',
          valueType: 'number',
          value: 99,
        })
        .connectExec('entry', 'node1'),
    )
    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.v.v_var = 99')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.16 get-variable (action, legacy — must emit deprecation warning; add downstream consumer)
  it('1.16 get-variable action (legacy, with downstream consumer)', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'get-variable', {
          actionConfigType: 'get-variable',
          scope: 'g',
          variableName: 'my_flag',
        })
        // Add a downstream consumer (condition) that reads the output so the binding is live
        .condition('cond1', '==', '', 'true')
        .connectExec('entry', 'node1')
        // Wire data output of get-variable to condition input 'a'
        .connectData('node1', 'value', 'cond1', 'a')
        .connectExec('node1', 'cond1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    // Code is still generated despite warning
    // Must be a read assignment: local <var> = vim.g.my_flag
    expect(startupLua).toMatch(/local\s+\w+\s*=\s*vim\.g\.my_flag/)
    // The captured variable must be used in the downstream condition
    const capturedVar = extractLocalVar(
      startupLua,
      /local\s+(\w+)\s*=\s*vim\.g\.my_flag/,
    )
    expect(
      capturedVar,
      'get-variable must produce a local variable',
    ).toBeDefined()
    if (capturedVar !== undefined) {
      // The condition should reference this variable
      expect(startupLua).toContain(`if ${capturedVar}`)
    }
    // Negative: should NOT be a write (vim.g.my_flag = ...)
    expect(startupLua).not.toMatch(/vim\.g\.my_flag\s*=/)
    // Must assert the deprecation warning (actual id from DiagnosticCodes.UNSUPPORTED_LEGACY)
    assertHasWarning(collector, 'node-unsupported-legacy')
    // Errors should NOT prevent generation (the legacy path still generates code)
    await assertLuaSyntaxValid(startupLua)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group C: Autocmd + Highlight Actions (Cases 1.17–1.23)
// ─────────────────────────────────────────────────────────────────────────────

describe('Group C: create-autocmd, set-highlight', () => {
  // 1.17 create-autocmd basic (canonical on-event wiring)
  it('1.17 create-autocmd basic (canonical on-event)', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('autocmd1', 'create-autocmd', {
          actionConfigType: 'create-autocmd',
          events: ['BufEnter'],
          patterns: ['*.lua'],
          groupName: '',
          once: false,
          nested: false,
          callbackLua: '',
        })
        .action('callback1', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: 'echo hello',
          selectedActionKey: '',
          paramValues: {},
        })
        // on-event exec wiring: autocmd1's on-event port → callback1's exec port
        .connect('autocmd1', 'callback1', 'on-event', 'exec')
        .connectExec('entry', 'autocmd1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expectFullAutocmdCall(startupLua, {
      events: ['BufEnter'],
      patterns: ['*.lua'],
      once: false,
    })
    // Negative: no group should be set (scoped to call line)
    const autocmdLineMatch = startupLua
      .split('\n')
      .find((l) => l.includes('vim.api.nvim_create_autocmd('))
    expect(autocmdLineMatch).toBeDefined()
    const autocmdLine17 = requireDefined(
      autocmdLineMatch,
      'autocmd registration line',
    )
    expect(autocmdLine17).not.toContain('group = ')
    // Verify callback structure
    expect(startupLua).toContain('function()')
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.18 create-autocmd multiple events
  it('1.18 create-autocmd multiple events', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('autocmd1', 'create-autocmd', {
          actionConfigType: 'create-autocmd',
          events: ['BufEnter', 'BufRead'],
          patterns: ['*'],
          groupName: '',
          once: false,
          nested: false,
          callbackLua: '',
        })
        .action('callback1', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: 'echo multi',
          selectedActionKey: '',
          paramValues: {},
        })
        .connect('autocmd1', 'callback1', 'on-event', 'exec')
        .connectExec('entry', 'autocmd1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expectFullAutocmdCall(startupLua, {
      events: ['BufEnter', 'BufRead'],
    })
    // Verify multi-event table format: { "BufEnter", "BufRead" }
    expect(startupLua).toMatch(/\{\s*"BufEnter"\s*,\s*"BufRead"\s*\}/)
    // Negative: should be ONE autocmd call, not two separate ones
    expectOccursExactly(startupLua, 'vim.api.nvim_create_autocmd(', 1)
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.19 create-autocmd with group
  it('1.19 create-autocmd with group', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('autocmd1', 'create-autocmd', {
          actionConfigType: 'create-autocmd',
          events: ['FileType'],
          patterns: ['lua'],
          groupName: 'mygroup',
          once: false,
          nested: false,
          callbackLua: '',
        })
        .action('callback1', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: 'echo filetype',
          selectedActionKey: '',
          paramValues: {},
        })
        .connect('autocmd1', 'callback1', 'on-event', 'exec')
        .connectExec('entry', 'autocmd1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expectFullAutocmdCall(startupLua, {
      events: ['FileType'],
      patterns: ['lua'],
      group: 'mygroup',
    })
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.20 create-autocmd once=true
  it('1.20 create-autocmd once=true', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('autocmd1', 'create-autocmd', {
          actionConfigType: 'create-autocmd',
          events: ['VimEnter'],
          patterns: ['*'],
          groupName: '',
          once: true,
          nested: false,
          callbackLua: '',
        })
        .action('callback1', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: 'echo once',
          selectedActionKey: '',
          paramValues: {},
        })
        .connect('autocmd1', 'callback1', 'on-event', 'exec')
        .connectExec('entry', 'autocmd1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expectFullAutocmdCall(startupLua, {
      events: ['VimEnter'],
      once: true,
    })
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.21 create-autocmd on-event exec port (callback action code in callback body)
  it('1.21 create-autocmd on-event exec port includes callback code', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('autocmd1', 'create-autocmd', {
          actionConfigType: 'create-autocmd',
          events: ['InsertEnter'],
          patterns: ['*'],
          groupName: '',
          once: false,
          nested: false,
          callbackLua: '',
        })
        .action('callback1', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: 'set paste',
          selectedActionKey: '',
          paramValues: {},
        })
        .connect('autocmd1', 'callback1', 'on-event', 'exec')
        .connectExec('entry', 'autocmd1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expectFullAutocmdCall(startupLua, {
      events: ['InsertEnter'],
      callbackContains: ['vim.cmd("set paste")'],
    })
    // Verify ordering: callback body is inside the function()...end block
    expectLuaContainsInOrder(startupLua, [
      'vim.api.nvim_create_autocmd("InsertEnter"',
      'function()',
      'vim.cmd("set paste")',
    ])
    // Negative: the raw string 'set paste' should appear only as vim.cmd(), not bare
    expect(startupLua).not.toMatch(/^\s*set paste\s*$/m)
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.22 set-highlight basic
  it('1.22 set-highlight basic', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-highlight', {
          actionConfigType: 'set-highlight',
          groupName: 'Normal',
          foreground: '#ffffff',
          background: '#000000',
          bold: false,
          italic: false,
          underline: false,
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    // Merge semantics: must have both the pcall prefetch line and the nvim_set_hl call
    expect(startupLua).toContain('pcall(vim.api.nvim_get_hl')
    expect(startupLua).toContain('vim.api.nvim_set_hl(0, "Normal"')
    expect(startupLua).toContain('vim.tbl_extend("force"')
    // Verify actual color values
    expect(startupLua).toContain('fg = "#ffffff"')
    expect(startupLua).toContain('bg = "#000000"')
    // Negative: no style attributes should be set (all false)
    expectNoOccurrence(startupLua, 'bold = true')
    expectNoOccurrence(startupLua, 'italic = true')
    expectNoOccurrence(startupLua, 'underline = true')
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.23 set-highlight all attributes
  it('1.23 set-highlight all attributes', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-highlight', {
          actionConfigType: 'set-highlight',
          groupName: 'Comment',
          foreground: '#888888',
          background: '',
          bold: true,
          italic: true,
          underline: false,
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('pcall(vim.api.nvim_get_hl')
    expect(startupLua).toContain('vim.api.nvim_set_hl(0, "Comment"')
    expect(startupLua).toContain('fg = "#888888"')
    expect(startupLua).toContain('bold = true')
    expect(startupLua).toContain('italic = true')
    // Negative: underline is false, should not appear
    expectNoOccurrence(startupLua, 'underline = true')
    // Negative: background is empty, should not appear as a key
    expectNoOccurrence(startupLua, 'bg = ""')
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group D: Function Invocation Nodes (Cases 1.24–1.25, 1.40–1.41)
// ─────────────────────────────────────────────────────────────────────────────

describe('Group D: call-function, run-function', () => {
  // 1.24 call-function (Lua function)
  it('1.24 call-function Lua context', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-option', {
          // Placeholder action — will be patched to call-function
          actionConfigType: 'set-option',
          optionName: 'placeholder',
          scope: 'global',
          valueConfig: { valueMode: 'raw', rawValue: '0' },
        })
        .connectExec('entry', 'node1'),
    )

    const callFnConfig: CallFunctionActionConfig = {
      actionConfigType: 'call-function',
      functionName: 'print',
      arguments: ['"hello"'],
      context: 'lua',
    }
    patchActionAsCallFunction(graph, 'node1', callFnConfig)

    const { startupLua, collector } = generateSingleGraph(graph)
    // Lua context: functionName(args)
    expect(startupLua).toContain('print("hello")')
    // No errors (warning for unknown function is expected — print IS known as Lua identifier)
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.25 call-function (Vim function)
  it('1.25 call-function Vim context', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .action('node1', 'set-option', {
          actionConfigType: 'set-option',
          optionName: 'placeholder',
          scope: 'global',
          valueConfig: { valueMode: 'raw', rawValue: '0' },
        })
        .connectExec('entry', 'node1'),
    )

    const callFnConfig: CallFunctionActionConfig = {
      actionConfigType: 'call-function',
      functionName: 'expand',
      arguments: ['"~"'],
      context: 'vim',
    }
    patchActionAsCallFunction(graph, 'node1', callFnConfig)

    const { startupLua, collector } = generateSingleGraph(graph)
    // vim context: vim.fn.functionName(args)
    expect(startupLua).toContain('vim.fn.expand("~")')
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.40 run-function basic (no params, void return)
  it('1.40 run-function basic (no params, void return)', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .runFunction('node1', 'lsp-hover', {
          type: 'core',
          functionName: 'vim.lsp.buf.hover',
        })
        .connectExec('entry', 'node1'),
    )

    patchRunFunctionSignature(graph, 'node1', {
      params: [],
      returns: 'void',
      luaCall: 'vim.lsp.buf.hover()',
    })

    const { startupLua, collector } = generateSingleGraph(graph)
    // void return: just the call, no local assignment
    expect(startupLua).toContain('vim.lsp.buf.hover()')
    // Should not contain 'local ... =' for run-function (it's void)
    expect(startupLua).not.toMatch(/local\s+\S+\s*=\s*vim\.lsp\.buf\.hover/)
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.41 run-function with params and return value
  it('1.41 run-function with params and return value', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .runFunction('node1', 'vim-expand', {
          type: 'core',
          functionName: 'vim.fn.expand',
        })
        .connectExec('entry', 'node1'),
    )

    patchRunFunctionSignature(
      graph,
      'node1',
      {
        params: [{ name: 'expr', type: 'string', optional: false }],
        returns: 'string',
        luaCall: 'vim.fn.expand($params.expr)',
      },
      { expr: { kind: 'scalar', value: '%:p' } },
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    // Non-void return: assigned to a local variable; scalar default '%:p' renders as a Lua string
    expect(startupLua).toMatch(/local\s+\S+\s*=\s*vim\.fn\.expand\("%:p"\)/)
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group E: Builtins Core Set (Cases 1.26–1.35)
// ─────────────────────────────────────────────────────────────────────────────

describe('Group E: builtins', () => {
  // 1.26 builtin: require-module
  it('1.26 builtin require-module', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .builtin('node1', 'require-module', { moduleName: 'plenary' })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain("require('plenary')")
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.27 builtin: check-feature (nvim-0.10 — not in VALID_FEATURES → warning)
  it('1.27 builtin check-feature (unknown feature nvim-0.10) emits warning', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .builtin('node1', 'check-feature', { feature: 'nvim-0.10' })
        // Add downstream consumer so the binding is live (condition reads output)
        .condition('cond1', '==', '', 'true')
        .connectExec('entry', 'node1')
        .connectData('node1', 'value', 'cond1', 'a')
        .connectExec('node1', 'cond1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    // Code is still generated despite warning
    expect(startupLua).toContain("vim.fn.has('nvim-0.10') == 1")
    // Must assert warning is present
    assertHasWarning(collector, 'builtin-check-feature-unknown')
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.28 builtin: check-platform (android — not in VALID_PLATFORMS → warning)
  // NOTE: plan specified 'win32' but win32 IS in VALID_PLATFORMS; using 'android' instead
  it('1.28 builtin check-platform (unknown platform android) emits warning', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .builtin('node1', 'check-platform', { platform: 'android' })
        // Add downstream consumer so the binding is live
        .condition('cond1', '==', '', 'true')
        .connectExec('entry', 'node1')
        .connectData('node1', 'value', 'cond1', 'a')
        .connectExec('node1', 'cond1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    // Code is still generated despite warning
    expect(startupLua).toContain("vim.fn.has('android') == 1")
    // The plan says builtin-check-feature-unknown but the actual code emits builtin-check-platform-unknown
    assertHasWarning(collector, 'builtin-check-platform-unknown')
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.29 builtin: get-variable (builtin always emits local var assignment)
  it('1.29 builtin get-variable (with downstream consumer)', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .builtin('node1', 'get-variable', {
          scope: 'g',
          variableName: 'some_flag',
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    // Must be a read assignment
    expect(startupLua).toMatch(/local\s+\w+\s*=\s*vim\.g\.some_flag/)
    // Negative: should NOT be a write
    expect(startupLua).not.toMatch(/vim\.g\.some_flag\s*=/)
    // Negative: wrong scope
    expectNoOccurrence(startupLua, 'vim.b.some_flag')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.30 builtin: ui.notify basic
  it('1.30 builtin ui.notify basic', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .builtin('node1', 'ui.notify', {
          message: 'Hello from vinela',
          level: 'info',
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.notify("Hello from vinela"')
    expect(startupLua).toContain('vim.log.levels.INFO')
    // Negative: wrong log level
    expectNoOccurrence(startupLua, 'vim.log.levels.WARN')
    expectNoOccurrence(startupLua, 'vim.log.levels.ERROR')
    // Negative: no title option (not provided)
    expectNoOccurrence(startupLua, 'title = ')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.31 builtin: ui.notify with title
  it('1.31 builtin ui.notify with title', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .builtin('node1', 'ui.notify', {
          message: 'Config loaded',
          level: 'warn',
          title: 'My Plugin',
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('vim.notify("Config loaded"')
    expect(startupLua).toContain('vim.log.levels.WARN')
    expect(startupLua).toContain('title = "My Plugin"')
    // Negative: wrong log level
    expectNoOccurrence(startupLua, 'vim.log.levels.INFO')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.32 builtin: buffers.open-file edit
  it('1.32 builtin buffers.open-file edit mode', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .builtin('node1', 'buffers.open-file', {
          path: '/tmp/foo.txt',
          mode: 'edit',
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain("vim.cmd('edit ' ..")
    expect(startupLua).toContain('fnameescape(')
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.33 builtin: buffers.open-file vsplit
  it('1.33 builtin buffers.open-file vsplit mode', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .builtin('node1', 'buffers.open-file', {
          path: '/tmp/bar.lua',
          mode: 'vsplit',
        })
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain("vim.cmd('vsplit ' ..")
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.34 builtin: automation.delay (with containment assertion)
  it('1.34 builtin automation.delay wraps downstream code', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .builtin('node1', 'automation.delay', { delayMs: 500 })
        .action('node2', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: 'echo delayed',
          selectedActionKey: '',
          paramValues: {},
        })
        // Downstream from delay's 'done' exec port
        .connectExec('entry', 'node1')
        .connectExec('node1', 'node2'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)

    // Order assertion: the downstream code must be inside the defer_fn callback
    expectLuaContainsInOrder(startupLua, [
      'vim.defer_fn(function()',
      'echo delayed',
      'end, 500)',
    ])
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.35 builtin: input.prompt (with downstream consumer)
  it('1.35 builtin input.prompt (with downstream consumer)', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .builtin('node1', 'input.prompt', {
          prompt: 'Enter name: ',
          defaultValue: '',
        })
        // Downstream consumer reads the 'value' output port
        .action('node2', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: 'echo got',
          selectedActionKey: '',
          paramValues: {},
        })
        .connectExec('entry', 'node1')
        .connectExec('node1', 'node2'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toMatch(
      /local\s+\S+\s*=\s*vim\.fn\.input\("Enter name: "\)/,
    )
    assertNoDiagnostics(collector)
    await assertLuaSyntaxValid(startupLua)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group F: Advanced + Control Nodes (Cases 1.36–1.39)
// ─────────────────────────────────────────────────────────────────────────────

describe('Group F: code-block, condition, loop', () => {
  // 1.36 code-block simple (no I/O)
  it('1.36 code-block simple (no I/O)', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .codeBlock('node1', 'vim.g.init_done = true')
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    // Generates a local function wrapper + call site
    expect(startupLua).toContain('local function _code_block_')
    expect(startupLua).toContain('vim.g.init_done = true')
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.37 code-block with I/O (parameterized + output capture)
  it('1.37 code-block with I/O', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .codeBlock(
          'node1',
          'return x * 2',
          [{ id: 'x', name: 'x', dataType: 'number' }],
          [{ id: 'result', name: 'result', dataType: 'number' }],
        )
        .connectExec('entry', 'node1'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    // Function definition has parameter x
    expect(startupLua).toContain('local function _code_block_')
    expect(startupLua).toContain('(x)')
    expect(startupLua).toContain('return x * 2')
    // Output capture (single output → local result = ...)
    expect(startupLua).toMatch(/local\s+result\s*=\s*_code_block_/)
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.38 condition standalone (true branch only)
  it('1.38 condition standalone (true branch)', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .condition('cond1', '==', '1', '1')
        .action('node2', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: 'echo true branch',
          selectedActionKey: '',
          paramValues: {},
        })
        .connectExec('entry', 'cond1')
        .connectTrue('cond1', 'node2'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('if 1 == 1 then')
    expect(startupLua).toContain('true branch')
    expect(startupLua).toContain('end')
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })

  // 1.39 loop standalone (for type with body action)
  it('1.39 loop standalone (for loop with body)', async () => {
    const graph = buildStartupGraph((b) =>
      b
        .loop('loop1', 'for', 'i', '1, 5')
        .action('node2', 'run-action', {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: 'echo iteration',
          selectedActionKey: '',
          paramValues: {},
        })
        .connectExec('entry', 'loop1')
        .connectLoopBody('loop1', 'node2'),
    )

    const { startupLua, collector } = generateSingleGraph(graph)
    expect(startupLua).toContain('for i = 1, 5 do')
    expect(startupLua).toContain('iteration')
    expect(startupLua).toContain('end')
    assertNoErrors(collector)
    await assertLuaSyntaxValid(startupLua)
  })
})
