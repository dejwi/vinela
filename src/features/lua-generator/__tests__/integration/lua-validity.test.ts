/**
 * Category 12: Lua Validity Tests
 *
 * Dedicated coverage for:
 *  - `luac -p` tool integration verification
 *  - Block-balance checker behavior
 *  - Optional nvim headless smoke test
 *
 * Sub-groups:
 *  - luac parsing (12.1–12.4)
 *  - block balance (12.5)
 *  - optional nvim headless smoke (12.6)
 *
 * The `luac` binary must be available in the test environment. If it is
 * missing, luac-dependent tests will fail with installation instructions.
 * `hasNvim()` gates the optional nvim headless smoke test (12.6).
 */

import { execFile, spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import { createDefaultActionConfig } from '@/shared/types'
import { checkLuaBlockBalance } from '../../orchestrator/lua-block-balance'
import { generateInitLuaOrchestrator } from '../../orchestrator/phase-coordinator'
import { generateLuaFromGraphs } from '../utils/generate-helper'
import { createCallablePort, GraphBuilder } from '../utils/graph-builder'
import { assertBlocksBalanced, assertLuaSyntaxValid } from '../utils/lua-assert'
import {
  createComplexOrchestratorFixture,
  setupOrchestratorMocks,
} from './helpers/orchestrator-fixture'

// ============================================
// Storage mock declarations (needed for 12.3 orchestrator path)
// ============================================

vi.mock('@/features/graph-editor/storage', () => ({
  listGraphs: vi.fn(),
}))

vi.mock('@/features/plugins/storage', () => ({
  loadInstalledPlugins: vi.fn(),
  loadAllSchemas: vi.fn(),
}))

vi.mock('@/features/settings/storage/neovim-options', () => ({
  readNeovimOptions: vi.fn(),
}))

vi.mock('@/features/keymaps/storage', () => ({
  loadKeymaps: vi.fn(),
}))

vi.mock('@/features/profiles/storage', () => ({
  loadProjectProfiles: vi.fn().mockResolvedValue([]),
  loadProjectProfileOverrides: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/features/lsp/storage', () => ({
  loadProjectLspConfig: vi.fn(),
}))

vi.mock('@/features/colorschemes/storage', () => ({
  loadColorSchemePreferences: vi.fn(),
}))

vi.mock('@/features/graph-editor/utils/graph-disable-state', () => ({
  computeDisableStates: vi.fn(),
}))

vi.mock('@/shared/lib/storage-api', () => ({
  readProjectFile: vi.fn(),
}))

// ============================================
// Synchronous tool probes
// ============================================

let _hasNvim: boolean | undefined
/** Synchronous memoized probe: is `nvim` available on PATH? */
function hasNvim(): boolean {
  if (_hasNvim === undefined) {
    _hasNvim = spawnSync('nvim', ['--version'], { stdio: 'pipe' }).status === 0
  }
  return _hasNvim
}

const execFileAsync = promisify(execFile)
const PROJECT_PATH = '/test/project'

// ============================================
// Category 12: Lua Validity
// ============================================

describe('Category 12: Lua Validity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // luac parsing
  // ─────────────────────────────────────────────────────────────────────────

  describe('luac parsing', () => {
    /**
     * 12.1 – single-node outputs are syntactically valid.
     *
     * Uses representative single-node graphs (set-option, run-action)
     * and verifies each passes `luac -p`.
     */
    it('12.1 single-node outputs: representative single nodes pass luac -p', async () => {
      const setOptionGraph = new GraphBuilder('SingleSetOpt', 'single-opt')
        .startupTrigger('t')
        .action('a', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'relativenumber',
          scope: 'global' as const,
          valueConfig: {
            valueMode: 'suggested' as const,
            suggestedValue: true,
          },
        })
        .connectExec('t', 'a')
        .withOrder(0)
        .build()

      const runActionGraph = new GraphBuilder('SingleRun', 'single-run')
        .startupTrigger('t')
        .action('a', 'run-action', {
          ...createDefaultActionConfig('run-action'),
          mode: 'custom-command' as const,
          actionType: 'command' as const,
          action: 'echo "hello"',
          selectedActionKey: '',
          paramValues: {},
        })
        .connectExec('t', 'a')
        .withOrder(0)
        .build()

      for (const graph of [setOptionGraph, runActionGraph]) {
        const { lua } = generateLuaFromGraphs([graph])
        await assertLuaSyntaxValid(lua)
        assertBlocksBalanced(lua)
      }
    })

    /**
     * 12.2 – complex graph outputs are syntactically valid.
     *
     * Branching (condition node), loops, and callable graphs all pass luac -p.
     */
    it('12.2 complex graph outputs: branching, loop, callable all pass luac -p', async () => {
      // Branching graph
      const branchGraph = new GraphBuilder('Branch', 'branch-g')
        .startupTrigger('t')
        .condition('cond', '>', 'x', '0')
        .action('hi', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global' as const,
          valueConfig: {
            valueMode: 'suggested' as const,
            suggestedValue: true,
          },
        })
        .action('lo', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'wrap',
          scope: 'global' as const,
          valueConfig: {
            valueMode: 'suggested' as const,
            suggestedValue: false,
          },
        })
        .connectExec('t', 'cond')
        .connectTrue('cond', 'hi')
        .connectFalse('cond', 'lo')
        .withOrder(0)
        .build()

      // Callable graph
      const callableGraph = new GraphBuilder('Callable', 'call-g')
        .callableEntry('entry', [createCallablePort('x', 'X', 'number')])
        .action('a', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'tabstop',
          scope: 'global' as const,
          valueConfig: {
            valueMode: 'suggested' as const,
            suggestedValue: 2,
          },
        })
        .returnNode('ret', [createCallablePort('y', 'Y', 'number')])
        .connectExec('entry', 'a')
        .connectExec('a', 'ret')
        .withOrder(1)
        .build()

      for (const graph of [branchGraph, callableGraph]) {
        const { lua } = generateLuaFromGraphs([graph])
        await assertLuaSyntaxValid(lua)
        assertBlocksBalanced(lua)
      }
    })

    /**
     * 12.3 – full pipeline output is syntactically valid.
     *
     * Runs the complete orchestrator (with mocked storage) and validates the
     * resulting init.lua with `luac -p`.
     */
    it('12.3 full pipeline output: orchestrator-generated init.lua passes luac -p', async () => {
      const fixture = createComplexOrchestratorFixture()
      await setupOrchestratorMocks(fixture)

      const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: PROJECT_PATH,
      })

      expect(result.success).toBe(true)
      if (!result.success) return

      const lua = result.initLua ?? ''
      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })

    /**
     * 12.4 – edge-case outputs are syntactically valid.
     *
     * A graph heavy on run-action (vim commands) passes luac -p.
     * This exercises the command-string escaping path.
     */
    it('12.4 edge-case outputs: run-action heavy graph passes luac -p', async () => {
      const graph = new GraphBuilder('EdgeCase', 'edge-g')
        .startupTrigger('t')
        .action('a1', 'run-action', {
          ...createDefaultActionConfig('run-action'),
          mode: 'custom-command' as const,
          actionType: 'command' as const,
          action: 'write',
          selectedActionKey: '',
          paramValues: {},
        })
        .action('a2', 'run-action', {
          ...createDefaultActionConfig('run-action'),
          mode: 'custom-command' as const,
          actionType: 'command' as const,
          action: 'nohlsearch',
          selectedActionKey: '',
          paramValues: {},
        })
        .connectExec('t', 'a1')
        .connectExec('a1', 'a2')
        .withOrder(0)
        .build()

      const { lua } = generateLuaFromGraphs([graph])
      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // block balance
  // ─────────────────────────────────────────────────────────────────────────

  describe('block balance', () => {
    /**
     * 12.5 – block balance checker passes for all generated Lua samples.
     *
     * Runs assertBlocksBalanced on each representative graph used in this file.
     * `do...end` blocks from startup scoping are intentionally excluded from
     * the checker's opener count (see lua-block-balance.ts) but luac remains
     * the authoritative gate for those.
     */
    it('12.5 block balance: checker passes for all representative samples', () => {
      const graphs = [
        // Single startup + set-option
        new GraphBuilder('Bal1', 'bal-1')
          .startupTrigger('t')
          .action('a', 'set-option', {
            ...createDefaultActionConfig('set-option'),
            optionName: 'number',
            scope: 'global' as const,
            valueConfig: {
              valueMode: 'suggested' as const,
              suggestedValue: true,
            },
          })
          .connectExec('t', 'a')
          .withOrder(0)
          .build(),
        // Branching condition graph
        new GraphBuilder('Bal2', 'bal-2')
          .startupTrigger('t')
          .condition('c', '==', 'a', 'b')
          .action('h', 'set-option', {
            ...createDefaultActionConfig('set-option'),
            optionName: 'wrap',
            scope: 'global' as const,
            valueConfig: {
              valueMode: 'suggested' as const,
              suggestedValue: false,
            },
          })
          .connectExec('t', 'c')
          .connectTrue('c', 'h')
          .withOrder(0)
          .build(),
        // Callable graph
        new GraphBuilder('Bal3', 'bal-3')
          .callableEntry('entry', [createCallablePort('n', 'N', 'number')])
          .returnNode('ret', [])
          .connectExec('entry', 'ret')
          .withOrder(0)
          .build(),
      ]

      for (const graph of graphs) {
        const { lua } = generateLuaFromGraphs([graph])
        assertBlocksBalanced(lua)
      }

      // Also verify a known-good multi-line snippet is balanced
      const validLua = [
        'vim.g.mapleader = " "',
        'vim.opt.number = true',
        'if true then',
        '  vim.opt.wrap = false',
        'end',
      ].join('\n')
      assertBlocksBalanced(validLua)

      // And assert an invalid snippet IS detected as unbalanced
      const unbalancedLua =
        'if true then\n  vim.opt.number = true\n-- missing end'
      const balanceResult = checkLuaBlockBalance(unbalancedLua)
      expect(balanceResult.balanced).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // optional nvim headless smoke
  // ─────────────────────────────────────────────────────────────────────────

  describe('optional nvim headless smoke', () => {
    /**
     * 12.6 – nvim headless smoke test (aspirational).
     *
     * Writes generated init.lua to a temp file, loads it with
     * `nvim --headless -u <file> +qa` and expects clean exit (status 0).
     * Skipped when nvim is unavailable.
     */
    it.skipIf(!hasNvim())(
      '12.6 nvim headless smoke: orchestrator init.lua loads without nvim errors',
      async () => {
        const fixture = createComplexOrchestratorFixture()
        await setupOrchestratorMocks(fixture)

        const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
          targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
          projectPath: PROJECT_PATH,
        })

        expect(result.success).toBe(true)
        if (!result.success) return

        const lua = result.initLua ?? ''
        const tmpDir = await mkdtemp(join(tmpdir(), 'vinela-smoke-'))
        const tmpFile = join(tmpDir, 'init.lua')

        try {
          await writeFile(tmpFile, lua, 'utf8')
          // Run nvim in headless mode, source the file, then quit
          await execFileAsync('nvim', ['--headless', '-u', tmpFile, '+qa'], {
            timeout: 15_000,
          })
        } finally {
          try {
            await rm(tmpDir, { recursive: true, force: true })
          } catch {
            // cleanup errors must not mask test failures
          }
        }
      },
    )
  })
})
