/**
 * Full Pipeline Integration Test
 *
 * Tests the complete orchestrator pipeline from project data to generated Lua.
 * Uses the same mock pattern as phase-coordinator.test.ts but exercises the
 * full generation flow with realistic fixture data.
 *
 * This replaces fragile browser-based E2E testing of generation which hangs
 * in Vite preview mode due to dynamic import chunk loading issues.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import { formatCallableId } from '@/features/lua-generator/lua-utils'
import type { Graph, GraphDisableState } from '@/shared/types'
import type { GenerationPhase, OrchestratorOptions } from '../../types'
import { generateInitLuaOrchestrator } from '../phase-coordinator'

// ============================================
// Mock all storage modules (same pattern as phase-coordinator.test.ts)
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

// ============================================
// Test Helpers
// ============================================

function createEnabledStateMap(
  graphs: readonly Graph[],
): ReadonlyMap<string, GraphDisableState> {
  return new Map(
    graphs.map((graph) => [
      graph.id,
      {
        graphId: graph.id,
        userEnabled: true,
        effective: { kind: 'enabled' as const },
      },
    ]),
  )
}

function createMockOptions(
  overrides?: Partial<OrchestratorOptions>,
): OrchestratorOptions {
  return {
    projectPath: '/test/project',
    targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
    ...overrides,
  }
}

/**
 * Set up all storage mocks with the given fixture data.
 * Mirrors the real data-loader's parallel loading.
 */
async function setupMocksWithFixture(fixture: {
  graphs: Graph[]
  plugins?: Array<{
    schemaId: string
    enabled: boolean
    config: Record<string, unknown>
  }>
  options?: {
    version: number
    options: Record<string, unknown>
    leaderKey?: string
    highlightOverrides?: Array<{
      id: string
      groupName: string
      foreground: string
      background: string
      bold: boolean
      italic: boolean
      underline: boolean
      strikethrough: boolean
      undercurl: boolean
      link: string
      enabled: boolean
      source: { kind: string }
    }>
    updatedAt: number
  } | null
  keymaps?: unknown[]
  lsp?: { enabledServers: string[] }
  colorscheme?: {
    activeScheme: string | null
    variantPreferences: Record<string, string>
  }
}): Promise<void> {
  const { listGraphs } = await import('@/features/graph-editor/storage')
  const { loadInstalledPlugins, loadAllSchemas } = await import(
    '@/features/plugins/storage'
  )
  const { readNeovimOptions } = await import(
    '@/features/settings/storage/neovim-options'
  )
  const { loadKeymaps } = await import('@/features/keymaps/storage')
  const { loadProjectLspConfig } = await import('@/features/lsp/storage')
  const { loadColorSchemePreferences } = await import(
    '@/features/colorschemes/storage'
  )
  const { computeDisableStates } = await import(
    '@/features/graph-editor/utils/graph-disable-state'
  )

  ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue(fixture.graphs)
  ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
    status: fixture.plugins !== undefined ? 'loaded' : 'file-not-found',
    plugins:
      fixture.plugins?.map((p) => ({
        schemaId: p.schemaId,
        enabled: p.enabled,
        config: p.config,
        addedAt: Date.now(),
      })) ?? [],
  })
  ;(loadAllSchemas as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(readNeovimOptions as ReturnType<typeof vi.fn>).mockResolvedValue(
    fixture.options ?? null,
  )
  ;(loadKeymaps as ReturnType<typeof vi.fn>).mockResolvedValue(
    fixture.keymaps ?? [],
  )
  ;(loadProjectLspConfig as ReturnType<typeof vi.fn>).mockResolvedValue(
    fixture.lsp ?? { enabledServers: [] },
  )
  ;(loadColorSchemePreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    data: fixture.colorscheme ?? {
      activeScheme: null,
      variantPreferences: {},
    },
    source: fixture.colorscheme !== undefined ? 'file' : 'default',
  })

  // Enable all graphs by default
  const enabledGraphs = fixture.graphs.filter((g) => g.enabled)
  ;(computeDisableStates as ReturnType<typeof vi.fn>).mockReturnValue({
    statesByGraphId: createEnabledStateMap(enabledGraphs),
  })
}

// ============================================
// Import fixture builders
// ============================================

import {
  createCallablePort,
  GraphBuilder,
} from '@/features/lua-generator/__tests__/utils/graph-builder'
import { createDefaultActionConfig } from '@/shared/types'

// ============================================
// Tests
// ============================================

describe('Full Generation Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Completion tests — ensure the pipeline ALWAYS terminates
  // ─────────────────────────────────────────────────────────────────────────

  it('completes for empty project (no graphs)', async () => {
    await setupMocksWithFixture({ graphs: [] })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()
    expect(result.metadata.graphsGenerated).toBe(0)
  })

  it('completes for minimal project with single startup graph', async () => {
    const graph = new GraphBuilder('Startup', 'startup-graph')
      .startupTrigger('entry')
      .action('setNumber', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('entry', 'setNumber')
      .build()

    await setupMocksWithFixture({
      graphs: [graph],
      options: {
        version: 1,
        options: {
          number: { valueType: 'boolean', value: true },
          relativenumber: { valueType: 'boolean', value: true },
        },
        leaderKey: ' ',
        updatedAt: Date.now(),
      },
    })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()
    expect(result.initLua).toContain('vim.g.mapleader')
    expect(result.metadata.graphsGenerated).toBe(1)
    expect(result.metadata.nodesGenerated).toBe(2)
  })

  it('completes for project with conditional graph', async () => {
    const graph = new GraphBuilder('Conditional', 'cond-graph')
      .startupTrigger('entry')
      .condition('cond1', '>', 'x', '5')
      .action('trueAction', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo "High"',
        selectedActionKey: '',
        paramValues: {},
      })
      .action('falseAction', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo "Low"',
        selectedActionKey: '',
        paramValues: {},
      })
      .connectExec('entry', 'cond1')
      .connectTrue('cond1', 'trueAction')
      .connectFalse('cond1', 'falseAction')
      .build()

    await setupMocksWithFixture({ graphs: [graph] })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()
  })

  it('completes for project with callable + startup graphs', async () => {
    const callableGraph = new GraphBuilder('Helper', 'helper-graph')
      .callableEntry('entry', [createCallablePort('msg', 'Message', 'string')])
      .action('process', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo msg',
        selectedActionKey: '',
        paramValues: {},
      })
      .returnNode('ret', [createCallablePort('result', 'Result', 'string')])
      .connectExec('entry', 'process')
      .connectExec('process', 'ret')
      .build()

    const startupGraph = new GraphBuilder('Main', 'main-graph')
      .startupTrigger('entry')
      .action('setNumber', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('entry', 'setNumber')
      .build()

    await setupMocksWithFixture({
      graphs: [callableGraph, startupGraph],
    })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()
    expect(result.metadata.graphsGenerated).toBe(2)
  })

  it('completes for project with loop graph (may produce diagnostics)', async () => {
    const graph = new GraphBuilder('Loop', 'loop-graph')
      .startupTrigger('entry')
      .loop('for1', 'for', 'i', '1, 10')
      .action('body', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo i',
        selectedActionKey: '',
        paramValues: {},
      })
      .connectExec('entry', 'for1')
      .connectLoopBody('for1', 'body')
      .build()

    await setupMocksWithFixture({ graphs: [graph] })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    // The primary assertion: the pipeline COMPLETES (doesn't hang).
    // Loop graphs may trigger pre-generation diagnostics (e.g., missing
    // loop-complete port), so we don't require success — just completion.
    expect(result.diagnostics).toBeDefined()
    expect(result.metadata).toBeDefined()
    expect(result.metadata.generationTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('completes for project with disabled graphs', async () => {
    const enabledGraph = new GraphBuilder('Enabled', 'enabled-graph')
      .startupTrigger('entry')
      .build()

    const disabledGraph = new GraphBuilder('Disabled', 'disabled-graph')
      .startupTrigger('entry')
      .withEnabled(false)
      .build()

    await setupMocksWithFixture({
      graphs: [enabledGraph, disabledGraph],
    })

    // Override computeDisableStates to properly reflect disabled state
    const { computeDisableStates } = await import(
      '@/features/graph-editor/utils/graph-disable-state'
    )
    ;(computeDisableStates as ReturnType<typeof vi.fn>).mockReturnValue({
      statesByGraphId: new Map([
        [
          'enabled-graph',
          {
            graphId: 'enabled-graph',
            userEnabled: true,
            effective: { kind: 'enabled' },
          },
        ],
        [
          'disabled-graph',
          {
            graphId: 'disabled-graph',
            userEnabled: false,
            effective: { kind: 'user-disabled' },
          },
        ],
      ]),
    })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    // Only 1 graph should be generated (the enabled one)
    expect(result.metadata.graphsGenerated).toBe(1)
    // Should emit a warning about the disabled graph
    expect(result.diagnostics.some((d) => d.id === 'WARN_GRAPH_DISABLED')).toBe(
      true,
    )
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Complex project integration (mirrors the complexProject fixture)
  // ─────────────────────────────────────────────────────────────────────────

  it('completes for complex project with all features', async () => {
    // Build a complex set of graphs
    const startupGraph = new GraphBuilder('Main Startup', 'main-startup')
      .startupTrigger('entry')
      .action('setNumber', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .action('setWrap', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'wrap',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: false },
      })
      .action('setKeymap', 'set-keymap', {
        ...createDefaultActionConfig('set-keymap'),
        modes: ['n'],
        keySequence: '<leader>te',
        command: ':echo "Test"<CR>',
        description: 'Test keymap',
        silent: true,
        noremap: true,
        expr: false,
        showInKeymaps: true,
      })
      .connectExec('entry', 'setNumber')
      .connectExec('setNumber', 'setWrap')
      .connectExec('setWrap', 'setKeymap')
      .build()

    const condGraph = new GraphBuilder('Conditional', 'cond-graph')
      .startupTrigger('entry')
      .condition('cond', '>', 'x', '5')
      .action('high', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo "High"',
        selectedActionKey: '',
        paramValues: {},
      })
      .action('low', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo "Low"',
        selectedActionKey: '',
        paramValues: {},
      })
      .connectExec('entry', 'cond')
      .connectTrue('cond', 'high')
      .connectFalse('cond', 'low')
      .withOrder(1)
      .build()

    const callableGraph = new GraphBuilder('Helper', 'helper-graph')
      .callableEntry('entry', [createCallablePort('name', 'Name', 'string')])
      .action('greet', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo "Hello"',
        selectedActionKey: '',
        paramValues: {},
      })
      .returnNode('ret', [createCallablePort('greeting', 'Greeting', 'string')])
      .connectExec('entry', 'greet')
      .connectExec('greet', 'ret')
      .withOrder(2)
      .build()

    await setupMocksWithFixture({
      graphs: [startupGraph, condGraph, callableGraph],
      options: {
        version: 1,
        options: {
          number: { valueType: 'boolean', value: true },
          relativenumber: { valueType: 'boolean', value: true },
          wrap: { valueType: 'boolean', value: false },
          tabstop: { valueType: 'number', value: 2 },
          shiftwidth: { valueType: 'number', value: 2 },
          expandtab: { valueType: 'boolean', value: true },
        },
        leaderKey: ' ',
        updatedAt: Date.now(),
      },
      lsp: {
        enabledServers: ['lua_ls', 'vtsls'],
      },
      colorscheme: {
        activeScheme: 'tokyonight',
        variantPreferences: {},
      },
    })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()
    expect(result.metadata.graphsGenerated).toBe(3)
    expect(result.metadata.linesOfCode).toBeGreaterThan(5)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Timing / performance safety tests
  // ─────────────────────────────────────────────────────────────────────────

  it('completes within 5 seconds', async () => {
    // Build a moderately complex project
    const graphs: Graph[] = []

    // Add 10 startup graphs
    for (let i = 0; i < 10; i++) {
      graphs.push(
        new GraphBuilder(`Startup ${i}`, `startup-${i}`)
          .startupTrigger('entry')
          .action(`action${i}`, 'set-option', {
            ...createDefaultActionConfig('set-option'),
            optionName: 'number',
            scope: 'global',
            valueConfig: { valueMode: 'suggested', suggestedValue: true },
          })
          .connectExec('entry', `action${i}`)
          .withOrder(i)
          .build(),
      )
    }

    await setupMocksWithFixture({
      graphs,
      options: {
        version: 1,
        options: {},
        updatedAt: Date.now(),
      },
    })

    const start = performance.now()
    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )
    const elapsed = performance.now() - start

    expect(result.success).toBe(true)
    expect(elapsed).toBeLessThan(5000)
    expect(result.metadata.graphsGenerated).toBe(10)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Cancellation tests
  // ─────────────────────────────────────────────────────────────────────────

  it('respects pre-abort signal', async () => {
    await setupMocksWithFixture({ graphs: [] })

    const controller = new AbortController()
    controller.abort()

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions({ signal: controller.signal }),
    )

    expect(result.success).toBe(false)
    expect(result.diagnostics[0]?.id).toBe('ERR_CANCELLED')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Progress phase ordering tests
  // ─────────────────────────────────────────────────────────────────────────

  it('emits all expected phases in order for a project with graphs', async () => {
    const graph = new GraphBuilder('Startup', 'startup-graph')
      .startupTrigger('entry')
      .action('action1', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('entry', 'action1')
      .build()

    await setupMocksWithFixture({
      graphs: [graph],
      options: {
        version: 1,
        options: {},
        leaderKey: ' ',
        updatedAt: Date.now(),
      },
    })

    const phases: GenerationPhase[] = []

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions({
        onProgress: (phase) => phases.push(phase),
      }),
    )

    expect(result.success).toBe(true)

    const phaseTypes = phases.map((p) => p.type)

    // Verify expected phase ordering
    expect(phaseTypes).toContain('validating')
    expect(phaseTypes).toContain('generating-sections')
    expect(phaseTypes).toContain('generating-graphs')
    expect(phaseTypes).toContain('validating-output')
    expect(phaseTypes).toContain('complete')

    // Verify phases appear in correct order
    const validatingIdx = phaseTypes.indexOf('validating')
    const sectionsIdx = phaseTypes.indexOf('generating-sections')
    const graphsIdx = phaseTypes.indexOf('generating-graphs')
    const outputIdx = phaseTypes.indexOf('validating-output')
    const completeIdx = phaseTypes.indexOf('complete')

    expect(validatingIdx).toBeLessThan(sectionsIdx)
    expect(sectionsIdx).toBeLessThan(graphsIdx)
    expect(graphsIdx).toBeLessThan(outputIdx)
    expect(outputIdx).toBeLessThan(completeIdx)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Output content verification
  // ─────────────────────────────────────────────────────────────────────────

  it('generates output containing vinela marker comment', async () => {
    await setupMocksWithFixture({ graphs: [] })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()
    // The assembly should include the marker comment for ownership detection
    expect(result.initLua).toContain('vinela')
  })

  it('generates Neovim options when configured', async () => {
    await setupMocksWithFixture({
      graphs: [],
      options: {
        version: 1,
        options: {
          number: { valueType: 'boolean', value: true },
          tabstop: { valueType: 'number', value: 4 },
        },
        updatedAt: Date.now(),
      },
    })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toContain('vim.opt.number')
    expect(result.initLua).toContain('vim.opt.tabstop')
  })

  it('generates leader key setting', async () => {
    await setupMocksWithFixture({
      graphs: [],
      options: {
        version: 1,
        options: {},
        leaderKey: ' ',
        updatedAt: Date.now(),
      },
    })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toContain('vim.g.mapleader')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Callable / keymap naming consistency
  // ─────────────────────────────────────────────────────────────────────────

  it('callable graph registration and keymap RHS use the same table key format', async () => {
    // The graph ID we'll use (UUID-style with hyphens — real app always uses UUIDs)
    const GRAPH_ID = '5820a708-7704-4dcf-8778-ac2b9cce70c9'

    // Build a callable graph that registers itself as _G._vinela_callables[GRAPH_ID]
    const callableGraph = new GraphBuilder('Format and Save', GRAPH_ID)
      .callableEntry('entry', [])
      .build()

    // Build a project keymap that calls that callable graph
    const keymap = {
      id: 'keymap-1',
      enabled: true,
      keySequence: 'dada',
      modes: ['n'],
      description: '',
      silent: true,
      noremap: true,
      expr: false,
      action: {
        actionType: 'run-custom-action' as const,
        graphId: GRAPH_ID,
        graphName: 'Format and Save',
      },
    }

    await setupMocksWithFixture({
      graphs: [callableGraph],
      keymaps: [keymap],
    })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()

    const lua = result.initLua ?? ''

    const expectedKey = formatCallableId('Format and Save', GRAPH_ID)
    expect(expectedKey).toBe('Format_and_Save_5820a7')

    expect(lua).toContainCallableRegistration('Format and Save', GRAPH_ID)
    expect(lua).toContainCallableInvocation('Format and Save', GRAPH_ID)

    // 3. Ensure the old broken symbol form is NOT present:
    //      _nvimset_5820a708_7704_4dcf_8778_ac2b9cce70c9
    expect(lua).not.toContain('_nvimset_')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata verification
  // ─────────────────────────────────────────────────────────────────────────

  it('reports accurate metadata', async () => {
    const graph = new GraphBuilder('Startup', 'startup-graph')
      .startupTrigger('entry')
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
      .connectExec('entry', 'a1')
      .connectExec('a1', 'a2')
      .build()

    await setupMocksWithFixture({ graphs: [graph] })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.metadata.graphsGenerated).toBe(1)
    expect(result.metadata.nodesGenerated).toBe(3) // trigger + 2 actions
    expect(result.metadata.linesOfCode).toBeGreaterThan(0)
    expect(result.metadata.generationTimeMs).toBeGreaterThanOrEqual(0)
    expect(result.metadata.phaseTimingsMs).toBeDefined()
    expect(Object.keys(result.metadata.phaseTimingsMs).length).toBeGreaterThan(
      0,
    )
  })
})
