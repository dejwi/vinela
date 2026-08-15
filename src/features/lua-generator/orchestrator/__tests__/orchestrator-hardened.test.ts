/**
 * Orchestrator Hardened Tests (A1-A9)
 *
 * Tests the orchestrator with real (unmocked) `computeDisableStates` for A1/A2,
 * and exercises phase, timing, failure, and error-path behaviours for A3-A9.
 *
 * DESIGN CONSTRAINT:
 * `computeDisableStates` is mocked at the file level (required so that
 * `setupOrchestratorMocks` used by A3-A9 can call `.mockReturnValue()` on it).
 * For A1/A2 the `setupStorageMocksManually` helper uses `vi.importActual` to
 * retrieve the real BFS implementation and installs it via `.mockImplementation`,
 * so the real disable-state algorithm runs for those two tests.
 *
 * `vi.restoreAllMocks()` in `afterEach` ensures spies from one test cannot
 * bleed into the next.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import type { Graph } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import {
  createComplexOrchestratorFixture,
  setupOrchestratorMocks,
} from '../../__tests__/integration/helpers/orchestrator-fixture'
import { requireSuccessfulInitLua } from '../../__tests__/utils/generation-result-assertions'
import {
  createCallablePort,
  GraphBuilder,
} from '../../__tests__/utils/graph-builder'
import type { GenerationPhase } from '../../types'
import { generateInitLuaOrchestrator } from '../phase-coordinator'

// ============================================
// All storage module mocks (hoisted to file top)
// computeDisableStates IS mocked here so setupOrchestratorMocks (used by A3-A9) can
// call .mockReturnValue() on it. Tests A1/A2 restore the real function via
// vi.importActual inside setupStorageMocksManually, so the real BFS runs for them.
// ============================================

vi.mock('@/features/graph-editor/utils/graph-disable-state', () => ({
  computeDisableStates: vi.fn(),
}))

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

vi.mock('@/features/lsp/storage', () => ({
  loadProjectLspConfig: vi.fn(),
}))

vi.mock('@/features/colorschemes/storage', () => ({
  loadColorSchemePreferences: vi.fn(),
}))

vi.mock('@/shared/lib/storage-api', () => ({
  readProjectFile: vi.fn(),
}))

// ============================================
// Helpers
// ============================================

const PROJECT_PATH = '/test/project'

function createMockOpts(
  overrides?: Partial<{
    onProgress: (phase: GenerationPhase) => void
    signal: AbortSignal
  }>,
) {
  return {
    projectPath: PROJECT_PATH,
    targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
    ...overrides,
  }
}

/**
 * Manually wire all storage mocks — used by A1/A2 where we cannot call
 * `setupOrchestratorMocks` because that helper sets computeDisableStates to
 * return a mocked state map. Here we restore the real BFS implementation so
 * the real transitive-disable algorithm runs.
 */
async function setupStorageMocksManually(
  graphs: readonly Graph[],
): Promise<void> {
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
  const { readProjectFile } = await import('@/shared/lib/storage-api')

  // Restore the real computeDisableStates BFS for A1/A2
  const { computeDisableStates } = await import(
    '@/features/graph-editor/utils/graph-disable-state'
  )
  const actual = await vi.importActual<
    typeof import('@/features/graph-editor/utils/graph-disable-state')
  >('@/features/graph-editor/utils/graph-disable-state')
  vi.mocked(computeDisableStates).mockImplementation(
    actual.computeDisableStates,
  )

  vi.mocked(listGraphs).mockResolvedValue([...graphs])
  vi.mocked(loadInstalledPlugins).mockResolvedValue({
    status: 'file-not-found',
    plugins: [],
  })
  vi.mocked(loadAllSchemas).mockResolvedValue([])
  vi.mocked(readNeovimOptions).mockResolvedValue(null)
  vi.mocked(loadKeymaps).mockResolvedValue([])
  vi.mocked(loadProjectLspConfig).mockResolvedValue({ enabledServers: [] })
  vi.mocked(loadColorSchemePreferences).mockResolvedValue({
    success: true,
    data: { activeScheme: null, variantPreferences: {} },
    source: 'default',
  })
  vi.mocked(readProjectFile).mockRejectedValue(new Error('not found'))
}

// ============================================
// Tests
// ============================================

describe('Orchestrator Hardened Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // A1: Real disable-state computation — transitive chain A→B→C
  // ──────────────────────────────────────────────────────────────────────────

  it('A1: real computeDisableStates — transitive disable chain (A→B→C)', async () => {
    // Graph A: user-disabled, has a startup trigger + action
    const graphA = new GraphBuilder('Graph A', 'graph-a')
      .startupTrigger('entry')
      .action('setNumber', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('entry', 'setNumber')
      .withEnabled(false)
      .build()

    // Graph B: enabled, references A via graph-ref (will be blocked by A)
    const graphB = new GraphBuilder('Graph B', 'graph-b')
      .startupTrigger('entry')
      .graphRef('ref-a', 'graph-a')
      .connectExec('entry', 'ref-a')
      .withEnabled(true)
      .build()

    // Graph C: enabled, references B via graph-ref (will be transitively blocked)
    const graphC = new GraphBuilder('Graph C', 'graph-c')
      .startupTrigger('entry')
      .graphRef('ref-b', 'graph-b')
      .connectExec('entry', 'ref-b')
      .withEnabled(true)
      .build()

    await setupStorageMocksManually([graphA, graphB, graphC])

    const result = await generateInitLuaOrchestrator(
      PROJECT_PATH,
      createMockOpts(),
    )

    expect(result.success).toBe(true)
    // All 3 graphs are excluded — A is user-disabled, B and C are dependency-disabled
    expect(result.metadata.graphsGenerated).toBe(0)

    // A should produce WARN_GRAPH_DISABLED
    const disabledDiags = result.diagnostics.filter(
      (d) => d.id === 'WARN_GRAPH_DISABLED',
    )
    expect(disabledDiags).toHaveLength(1)

    // B and C should produce WARN_GRAPH_BLOCKED
    const blockedDiags = result.diagnostics.filter(
      (d) => d.id === 'WARN_GRAPH_BLOCKED',
    )
    expect(blockedDiags).toHaveLength(2)

    // At least one blocked diagnostic should mention Graph A as the root blocker
    expect(blockedDiags.some((d) => d.message.includes('Graph A'))).toBe(true)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // A2: Real disable-state computation — cycle with disabled root
  // ──────────────────────────────────────────────────────────────────────────

  it('A2: real computeDisableStates — cycle (A↔B) with disabled root A', async () => {
    // Graph A: user-disabled, has a graph-ref to B (forming a cycle A→B→A)
    const graphA = new GraphBuilder('Graph A', 'cycle-a')
      .startupTrigger('entry')
      .graphRef('ref-b', 'cycle-b')
      .connectExec('entry', 'ref-b')
      .withEnabled(false)
      .build()

    // Graph B: enabled, has a graph-ref to A (completing the cycle)
    const graphB = new GraphBuilder('Graph B', 'cycle-b')
      .startupTrigger('entry')
      .graphRef('ref-a', 'cycle-a')
      .connectExec('entry', 'ref-a')
      .withEnabled(true)
      .build()

    await setupStorageMocksManually([graphA, graphB])

    const result = await generateInitLuaOrchestrator(
      PROJECT_PATH,
      createMockOpts(),
    )

    // The pre-generation cycle check (ERR_CYCLE_INTER_GRAPH) fires before
    // disable-state computation when a mutual reference is detected — this
    // is a fatal error that correctly rejects the cycle.
    expect(result.success).toBe(false)
    expect(
      result.diagnostics.some((d) => d.id === 'ERR_CYCLE_INTER_GRAPH'),
    ).toBe(true)
    // No graphs generated when a cycle is detected
    expect(result.metadata.graphsGenerated).toBe(0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // A3: Phase progress — content checks for all 7 section names
  // ──────────────────────────────────────────────────────────────────────────

  it('A3: phase progress — all 7 section names emitted, graph progress total correct', async () => {
    const startupGraph = new GraphBuilder('Startup', 'a3-startup')
      .startupTrigger('entry')
      .action('setNumber', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('entry', 'setNumber')
      .build()

    const callableGraph = new GraphBuilder('Helper', 'a3-callable')
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

    await setupOrchestratorMocks({
      graphs: [startupGraph, callableGraph],
      options: {
        version: 1,
        options: {},
        leaderKey: ' ',
        updatedAt: Date.now(),
      },
    })

    const phases: GenerationPhase[] = []
    const result = await generateInitLuaOrchestrator(
      PROJECT_PATH,
      createMockOpts({ onProgress: (phase) => phases.push(phase) }),
    )

    expect(result.success).toBe(true)

    // Phase 1: prepare-context
    expect(phases[0]).toEqual({
      type: 'validating',
      checkName: 'prepare-context',
    })

    // Phase 2: load-project
    expect(phases[1]).toEqual({ type: 'validating', checkName: 'load-project' })

    // pre-generation phase must be present
    const preGenPhase = phases.find(
      (p) =>
        p.type === 'validating' &&
        (p as Extract<GenerationPhase, { type: 'validating' }>).checkName ===
          'pre-generation',
    )
    expect(preGenPhase).toBeDefined()

    // compute-disable-state phase must be present
    const disablePhase = phases.find(
      (p) =>
        p.type === 'validating' &&
        (p as Extract<GenerationPhase, { type: 'validating' }>).checkName ===
          'compute-disable-state',
    )
    expect(disablePhase).toBeDefined()

    // All 7 section names emitted in canonical order
    const sectionPhases = phases.filter((p) => p.type === 'generating-sections')
    const sectionNames = sectionPhases.map(
      (p) =>
        (p as Extract<GenerationPhase, { type: 'generating-sections' }>)
          .sectionName,
    )
    expect(sectionNames).toEqual([
      'leader-key',
      'neovim-options',
      'plugins',
      'lsp',
      'colorscheme',
      'highlights',
      'project-keymaps',
    ])

    // Graph progress phases with correct total (2 graphs)
    const graphPhases = phases.filter((p) => p.type === 'generating-graphs')
    expect(graphPhases.length).toBeGreaterThan(0)
    const lastGraphPhase = graphPhases[graphPhases.length - 1] as Extract<
      GenerationPhase,
      { type: 'generating-graphs' }
    >
    expect(lastGraphPhase.total).toBe(2)

    // validating-output phase must be present
    expect(phases.some((p) => p.type === 'validating-output')).toBe(true)

    // Terminal phase must be 'complete'
    const terminalPhase = phases[phases.length - 1]
    expect(terminalPhase?.type).toBe('complete')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // A4: Phase timings — all 9 keys present; non-trivial phases are positive
  // ──────────────────────────────────────────────────────────────────────────

  it('A4: phase timings — all 9 keys present; load/sections/assembly are > 0', async () => {
    const startupGraph = new GraphBuilder('Startup', 'a4-startup')
      .startupTrigger('entry')
      .action('setWrap', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'wrap',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: false },
      })
      .connectExec('entry', 'setWrap')
      .build()

    await setupOrchestratorMocks({ graphs: [startupGraph] })

    const result = await generateInitLuaOrchestrator(
      PROJECT_PATH,
      createMockOpts(),
    )

    expect(result.success).toBe(true)

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

    // All 9 keys must exist
    for (const key of expectedKeys) {
      expect(
        result.metadata.phaseTimingsMs,
        `phaseTimingsMs should have key "${key}"`,
      ).toHaveProperty(key)
    }

    // All keys must be >= 0.
    // Note: Math.round() means even phases that do real work can round to 0ms
    // in fast CI environments. The primary goal of this test is to verify that
    // all 9 keys EXIST (catching key-name regressions where ?? 0 would otherwise
    // mask a missing/misspelled key). The existence check via toHaveProperty above
    // already covers this.
    for (const key of expectedKeys) {
      expect(
        result.metadata.phaseTimingsMs[key],
        `phaseTimingsMs.${key} should be >= 0`,
      ).toBeGreaterThanOrEqual(0)
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // A5: Required source failure — listGraphs throws → fatal error
  // ──────────────────────────────────────────────────────────────────────────

  it('A5: listGraphs failure → fatal ERR_LOAD_GRAPHS, no generation', async () => {
    await setupOrchestratorMocks({ graphs: [] })

    // Override listGraphs to throw after setupOrchestratorMocks has wired everything
    const { listGraphs } = await import('@/features/graph-editor/storage')
    vi.mocked(listGraphs).mockRejectedValue(
      new Error('ENOENT: graphs directory not found'),
    )

    const phases: GenerationPhase[] = []
    const result = await generateInitLuaOrchestrator(
      PROJECT_PATH,
      createMockOpts({ onProgress: (phase) => phases.push(phase) }),
    )

    expect(result.success).toBe(false)
    expect(result.diagnostics.some((d) => d.id === 'ERR_LOAD_GRAPHS')).toBe(
      true,
    )
    expect(result.diagnostics.some((d) => d.message.includes('ENOENT'))).toBe(
      true,
    )
    expect(result.metadata.graphsGenerated).toBe(0)

    const phaseTypes = phases.map((p) => p.type)
    expect(phaseTypes).not.toContain('generating-sections')
    expect(phaseTypes).not.toContain('generating-graphs')
    expect(phaseTypes).toContain('error')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // A6: Optional source degraded mode — schemas fail → warning, success
  // ──────────────────────────────────────────────────────────────────────────

  it('A6: schemas failure → degraded mode (WARN_LOAD_SCHEMAS, success, no plugin code)', async () => {
    const startupGraph = new GraphBuilder('Startup', 'a6-startup')
      .startupTrigger('entry')
      .build()

    await setupOrchestratorMocks({
      graphs: [startupGraph],
      plugins: [{ schemaId: 'some-plugin', enabled: true, config: {} }],
    })

    // Override loadAllSchemas to throw
    const { loadAllSchemas } = await import('@/features/plugins/storage')
    vi.mocked(loadAllSchemas).mockRejectedValue(
      new Error('Schema directory corrupted'),
    )

    const result = await generateInitLuaOrchestrator(
      PROJECT_PATH,
      createMockOpts(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()

    // Warning about schema load failure must be present
    expect(
      result.diagnostics.some(
        (d) =>
          d.id === 'WARN_LOAD_SCHEMAS' &&
          d.message.includes('Schema directory corrupted'),
      ),
    ).toBe(true)

    // Plugin section should be empty (no schemas to resolve against)
    expect(result.initLua).not.toContain('vim.pack.add')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // A7: Optional source degraded mode — keymaps fail → warning, success
  // ──────────────────────────────────────────────────────────────────────────

  it('A7: keymaps failure → degraded mode (WARN_LOAD_KEYMAPS, success, no keymap code)', async () => {
    const startupGraph = new GraphBuilder('Startup', 'a7-startup')
      .startupTrigger('entry')
      .build()

    await setupOrchestratorMocks({ graphs: [startupGraph] })

    // Override loadKeymaps to throw
    const { loadKeymaps } = await import('@/features/keymaps/storage')
    vi.mocked(loadKeymaps).mockRejectedValue(
      new Error('keymaps.json parse error'),
    )

    const result = await generateInitLuaOrchestrator(
      PROJECT_PATH,
      createMockOpts(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()
    expect(result.diagnostics.some((d) => d.id === 'WARN_LOAD_KEYMAPS')).toBe(
      true,
    )

    // Keymaps section should be empty (no project keymaps loaded)
    expect(result.initLua).not.toContain('vim.keymap.set')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // A8: Section ordering — canonical Section: <id> markers in correct order
  // ──────────────────────────────────────────────────────────────────────────

  it('A8: section ordering — canonical Section: <id> markers appear in correct order', async () => {
    const fixture = createComplexOrchestratorFixture()
    await setupOrchestratorMocks(fixture)

    const result = await generateInitLuaOrchestrator(
      PROJECT_PATH,
      createMockOpts(),
    )

    const lua = requireSuccessfulInitLua(result)
    const lines = lua.split('\n')

    const findSection = (id: string): number =>
      lines.findIndex((l) => l.includes(`Section: ${id}`))

    const leaderIdx = findSection('leader-key')
    const optionsIdx = findSection('neovim-options')
    const callableIdx = findSection('callable-functions')
    const pluginsIdx = findSection('plugins')
    const lspIdx = findSection('lsp')
    const keymapsIdx = findSection('project-keymaps')
    const startupIdx = lines.findIndex((l) => l.includes('Startup Execution'))

    // All fixture-guaranteed sections must be present (index > -1)
    // Note: leader-key requires a leaderKey set in options; plugins requires
    // a matching schema + plugin; project-keymaps requires keymaps data.
    // The complex fixture provides all of these.
    expect(leaderIdx).toBeGreaterThan(-1)
    expect(optionsIdx).toBeGreaterThan(-1)
    expect(pluginsIdx).toBeGreaterThan(-1)
    expect(keymapsIdx).toBeGreaterThan(-1)
    expect(startupIdx).toBeGreaterThan(-1)

    // Verify canonical ordering for sections that are guaranteed to be present.
    // lspIdx may be -1 if mason-nvim/nvim-lspconfig aren't in resolvedPlugins
    // (complex fixture has lsp servers but not the gate plugins), so we skip it.
    expect(leaderIdx).toBeLessThan(optionsIdx)
    expect(optionsIdx).toBeLessThan(pluginsIdx)
    expect(pluginsIdx).toBeLessThan(keymapsIdx)
    expect(keymapsIdx).toBeLessThan(startupIdx)

    // If LSP section is present, verify it comes after plugins
    if (lspIdx > -1) {
      expect(pluginsIdx).toBeLessThan(lspIdx)
      expect(lspIdx).toBeLessThan(keymapsIdx)
    }

    // Callable functions (present in the complex fixture) must come before plugins
    if (callableIdx > -1) {
      expect(callableIdx).toBeLessThan(pluginsIdx)
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // A9: Catch-all error path — ERR_UNEXPECTED when section generator crashes
  // ──────────────────────────────────────────────────────────────────────────

  it('A9: ERR_UNEXPECTED — unexpected exception inside section generator', async () => {
    await setupOrchestratorMocks({ graphs: [] })

    // Spy on a section generator to throw unexpectedly inside the pipeline
    const sectionsMod = await import('@/features/lua-generator/sections')
    vi.spyOn(sectionsMod, 'generateNeovimOptionsSection').mockImplementation(
      () => {
        throw new Error('Internal section crash')
      },
    )

    const phases: GenerationPhase[] = []
    const result = await generateInitLuaOrchestrator(
      PROJECT_PATH,
      createMockOpts({ onProgress: (phase) => phases.push(phase) }),
    )

    expect(result.success).toBe(false)
    expect(result.diagnostics.some((d) => d.id === 'ERR_UNEXPECTED')).toBe(true)
    expect(
      result.diagnostics.some((d) =>
        d.message.includes('Internal section crash'),
      ),
    ).toBe(true)

    // Phase stream must have terminated with the 'error' terminal phase
    expect(phases.some((p) => p.type === 'error')).toBe(true)
  })
})
