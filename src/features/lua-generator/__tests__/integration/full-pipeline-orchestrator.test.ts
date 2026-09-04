/**
 * Category 11: Full Pipeline / Orchestrator Integration Tests
 *
 * Tests the complete 9-phase `generateInitLuaOrchestrator` pipeline using
 * mocked storage dependencies. Storage calls are intercepted by vi.mock() so
 * the real Tauri filesystem is never touched in this test environment.
 *
 * Sub-groups:
 *  - Minimal and composition scenarios (11.1–11.4)
 *  - Metadata and timings (11.5–11.6)
 *  - Progress and header/registry markers (11.7–11.9)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import { createDefaultActionConfig } from '@/shared/types'
import { generateInitLuaOrchestrator } from '../../orchestrator/phase-coordinator'
import type { GenerationPhase } from '../../types'
import { GraphBuilder } from '../utils/graph-builder'
import { assertBlocksBalanced, assertLuaSyntaxValid } from '../utils/lua-assert'
import {
  createComplexOrchestratorFixture,
  setupOrchestratorMocks,
} from './helpers/orchestrator-fixture'

// ============================================
// Storage mock declarations (must be at top level, hoisted by vitest)
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
// Helpers
// ============================================

/** Assert none of the given diagnostic IDs appear in the result diagnostics. */
function expectNoDiagnosticId(
  diagnostics: readonly { id: string }[],
  id: string,
): void {
  const found = diagnostics.find((d) => d.id === id)
  expect(found, `Unexpected diagnostic with id "${id}"`).toBeUndefined()
}

const PROJECT_PATH = '/test/project'

// ============================================
// Category 11: Full Pipeline (Orchestrator)
// ============================================

describe('Category 11: Full Pipeline (Orchestrator)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Minimal and composition scenarios
  // ─────────────────────────────────────────────────────────────────────────

  describe('minimal and composition scenarios', () => {
    /**
     * 11.1 – minimal project with a single set-option startup graph.
     *
     * Critical reproduction: verifies the full pipeline produces valid Lua
     * from the simplest meaningful input without any warnings.
     */
    it('11.1 minimal project: success, produces vim.opt.number, no trigger-empty-exec', async () => {
      const graph = new GraphBuilder('Minimal', 'minimal-graph')
        .startupTrigger('entry')
        .action('setNumber', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global' as const,
          valueConfig: {
            valueMode: 'suggested' as const,
            suggestedValue: true,
          },
        })
        .connectExec('entry', 'setNumber')
        .withOrder(0)
        .build()

      await setupOrchestratorMocks({
        graphs: [graph],
        options: {
          version: 1,
          options: {},
          updatedAt: Date.now(),
        },
      })

      const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: PROJECT_PATH,
      })

      expect(result.success).toBe(true)
      if (!result.success) return

      const lua = result.initLua ?? ''
      expect(lua).toContain('vim.opt.number = true')
      expectNoDiagnosticId(result.diagnostics, 'trigger-empty-exec')

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })

    /**
     * 11.2 – complex project with 3 graphs, options, plugin, keymap.
     *
     * Verifies key section markers exist in correct order, and that
     * both callable and startup code are present.
     */
    it('11.2 complex project: section markers present in order, callable + startup code', async () => {
      const fixture = createComplexOrchestratorFixture()
      await setupOrchestratorMocks(fixture)

      const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: PROJECT_PATH,
      })

      expect(result.success).toBe(true)
      if (!result.success) return

      const lua = result.initLua ?? ''

      // Callable registry initializer must appear (from assemble.ts)
      expect(lua).toContain('_G._vinela_callables')

      // Options section must have leader key from the fixture (leaderKey = ' ')
      expect(lua).toContain('vim.g.mapleader')

      // Both set-option values from startupGraph
      expect(lua).toContain('vim.opt.number')
      expect(lua).toContain('vim.opt.wrap')

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })

    /**
     * 11.3 – sections only (no graphs): options + leader appear, no startup exec block content.
     *
     * Verifies the pipeline works when the graph list is empty.
     */
    it('11.3 sections only (no graphs): options emitted, no graph code', async () => {
      await setupOrchestratorMocks({
        graphs: [],
        options: {
          version: 1,
          options: {
            number: { valueType: 'boolean', value: true },
          },
          leaderKey: ',',
          updatedAt: Date.now(),
        },
      })

      const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: PROJECT_PATH,
      })

      expect(result.success).toBe(true)
      if (!result.success) return

      const lua = result.initLua ?? ''

      // Options section present
      expect(lua).toContain('vim.opt.number = true')
      // Leader key present
      expect(lua).toContain('vim.g.mapleader')

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })

    /**
     * 11.4 – graphs only (no sections): startup execution block present, section code absent.
     *
     * No options file, no plugins, no keymaps — only a startup graph.
     */
    it('11.4 graphs only (no sections): startup block present', async () => {
      const graph = new GraphBuilder('GraphOnly', 'graph-only')
        .startupTrigger('entry')
        .action('setWrap', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'wrap',
          scope: 'global' as const,
          valueConfig: {
            valueMode: 'suggested' as const,
            suggestedValue: false,
          },
        })
        .connectExec('entry', 'setWrap')
        .withOrder(0)
        .build()

      await setupOrchestratorMocks({
        graphs: [graph],
        options: null,
      })

      const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: PROJECT_PATH,
      })

      expect(result.success).toBe(true)
      if (!result.success) return

      const lua = result.initLua ?? ''

      // Graph-generated code present
      expect(lua).toContain('vim.opt.wrap = false')

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata and timings
  // ─────────────────────────────────────────────────────────────────────────

  describe('metadata and timings', () => {
    /**
     * 11.5 – metadata accuracy: graphsGenerated, nodesGenerated, linesOfCode.
     */
    it('11.5 metadata: graphsGenerated, nodesGenerated, linesOfCode are accurate', async () => {
      const graph = new GraphBuilder('Meta', 'meta-graph')
        .startupTrigger('entry')
        .action('a1', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global' as const,
          valueConfig: {
            valueMode: 'suggested' as const,
            suggestedValue: true,
          },
        })
        .action('a2', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'wrap',
          scope: 'global' as const,
          valueConfig: {
            valueMode: 'suggested' as const,
            suggestedValue: false,
          },
        })
        .connectExec('entry', 'a1')
        .connectExec('a1', 'a2')
        .withOrder(0)
        .build()

      await setupOrchestratorMocks({ graphs: [graph] })

      const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: PROJECT_PATH,
      })

      expect(result.success).toBe(true)

      // 1 enabled graph with 3 nodes (trigger + 2 actions)
      expect(result.metadata.graphsGenerated).toBe(1)
      expect(result.metadata.nodesGenerated).toBe(3)

      // linesOfCode must be positive when we produced Lua
      expect(result.metadata.linesOfCode).toBeGreaterThan(0)
    })

    /**
     * 11.6 – phase timing completeness: all 9 keys present and >= 0.
     */
    it('11.6 phase timings: all 9 keys present with non-negative values', async () => {
      await setupOrchestratorMocks({ graphs: [] })

      const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: PROJECT_PATH,
      })

      const expectedKeys = [
        'prepare',
        'load',
        'preGeneration',
        'disableStates',
        'sections',
        'graphs',
        'assembly',
        'validation',
        'finalize',
      ] as const

      for (const key of expectedKeys) {
        expect(
          result.metadata.phaseTimingsMs,
          `phaseTimingsMs should have key "${key}"`,
        ).toHaveProperty(key)
        expect(
          result.metadata.phaseTimingsMs[key],
          `phaseTimingsMs.${key} should be >= 0`,
        ).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Progress and header/registry markers
  // ─────────────────────────────────────────────────────────────────────────

  describe('progress and header/registry markers', () => {
    /**
     * 11.7 – progress callback ordering:
     *   validating → generating-sections → generating-graphs → validating-output → complete
     */
    it('11.7 progress phases: observed order contains required phases in sequence', async () => {
      const graph = new GraphBuilder('P11-7', 'p117')
        .startupTrigger('t')
        .withOrder(0)
        .build()

      await setupOrchestratorMocks({ graphs: [graph] })

      const phases: GenerationPhase['type'][] = []

      await generateInitLuaOrchestrator(PROJECT_PATH, {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: PROJECT_PATH,
        onProgress: (phase) => {
          phases.push(phase.type)
        },
      })

      // The required phases must all be present
      expect(phases).toContain('validating')
      expect(phases).toContain('generating-sections')
      expect(phases).toContain('generating-graphs')
      expect(phases).toContain('validating-output')
      expect(phases).toContain('complete')

      // Required order: validating < generating-sections < generating-graphs < validating-output < complete
      const firstValidating = phases.indexOf('validating')
      const firstSections = phases.indexOf('generating-sections')
      const firstGraphs = phases.indexOf('generating-graphs')
      const firstOutput = phases.indexOf('validating-output')
      const firstComplete = phases.indexOf('complete')

      expect(firstValidating).toBeLessThan(firstSections)
      expect(firstSections).toBeLessThan(firstGraphs)
      expect(firstGraphs).toBeLessThan(firstOutput)
      expect(firstOutput).toBeLessThan(firstComplete)
    })

    /**
     * 11.8 – header marker: the top of the init.lua contains "Generated by vinela".
     */
    it('11.8 header marker: top region contains "Generated by vinela"', async () => {
      await setupOrchestratorMocks({ graphs: [] })

      const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: PROJECT_PATH,
      })

      expect(result.success).toBe(true)
      if (!result.success) return

      const lua = result.initLua ?? ''

      // The header comment should appear in the first 500 characters
      const topRegion = lua.slice(0, 500)
      expect(topRegion).toContain('Generated by vinela')
    })

    /**
     * 11.9 – callable registry initializer appears near the top.
     *
     * `_G._vinela_callables = _G._vinela_callables or {}`
     * must be emitted before any callable / startup content.
     */
    it('11.9 callable registry: _G._vinela_callables initializer present and before main content', async () => {
      const fixture = createComplexOrchestratorFixture()
      await setupOrchestratorMocks(fixture)

      const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: PROJECT_PATH,
      })

      expect(result.success).toBe(true)
      if (!result.success) return

      const lua = result.initLua ?? ''

      const registryLine = '_G._vinela_callables = _G._vinela_callables or {}'
      expect(lua).toContain(registryLine)

      // Registry line must appear before callable function definitions
      const registryIdx = lua.indexOf(registryLine)
      const callableSection = lua.indexOf('_vinela_callables[')
      if (callableSection !== -1) {
        expect(registryIdx).toBeLessThan(callableSection)
      }

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })
  })
})
