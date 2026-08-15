/**
 * Orchestrator Failure Path Integration Tests (C3-C6)
 *
 * Uses mocked storage (via top-level vi.mock, same as full-pipeline-orchestrator.test.ts).
 * Tests error recovery, Lua validity, block balance, and callable output structure.
 *
 * C3 — error recovery when pre-generation check fails
 * C4 — full pipeline output is syntactically valid Lua (luac check, errors if not available)
 * C5 — generated Lua has balanced block structure (pure TypeScript check)
 * C6 — callable graph output structure (registry + callable section + startup ordering)
 *
 * IMPORTANT: Kept separate from storage-roundtrip.test.ts because the top-level
 * vi.mock() calls here would intercept storage functions in C1/C2 if they were
 * in the same file (Vitest hoists vi.mock to the top of each file).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import { createDefaultActionConfig } from '@/shared/types'
import { checkLuaBlockBalance } from '../../orchestrator/lua-block-balance'
import { generateInitLuaOrchestrator } from '../../orchestrator/phase-coordinator'
import type { GenerationPhase } from '../../types'
import { requireSuccessfulInitLua } from '../utils/generation-result-assertions'
import { createCallablePort, GraphBuilder } from '../utils/graph-builder'
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

const PROJECT_PATH = '/test/project'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// C3: Error recovery — pre-generation check fails for graph-ref with no target
// ─────────────────────────────────────────────────────────────────────────────

describe('C3: error recovery — pre-generation failure for invalid graph-ref', () => {
  it('graph with empty referencedGraphId → ERR_REF_GRAPH_REF_NO_TARGET, no graphs generated', async () => {
    // Valid startup graph
    const validGraph = new GraphBuilder('Valid Startup', 'c3-valid')
      .startupTrigger('entry')
      .action('setNumber', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('entry', 'setNumber')
      .build()

    // Graph with an invalid graph-ref node (empty referencedGraphId)
    const badGraph = new GraphBuilder('Bad Graph Ref', 'c3-bad')
      .startupTrigger('entry')
      .graphRef('ref-empty', '') // empty referencedGraphId triggers ERR_REF_GRAPH_REF_NO_TARGET
      .connectExec('entry', 'ref-empty')
      .build()

    await setupOrchestratorMocks({
      graphs: [validGraph, badGraph],
    })

    const phases: GenerationPhase[] = []
    const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: PROJECT_PATH,
      onProgress: (phase) => phases.push(phase),
    })

    // Pre-generation errors are fatal — orchestrator returns success: false
    expect(result.success).toBe(false)

    // Should identify the specific diagnostic
    expect(
      result.diagnostics.some((d) => d.id === 'ERR_REF_GRAPH_REF_NO_TARGET'),
    ).toBe(true)

    // No graphs should have been generated
    expect(result.metadata.graphsGenerated).toBe(0)

    // Phase stream: pre-generation ran but graph generation did not
    const phaseTypes = phases.map((p) => p.type)
    expect(phaseTypes).toContain('validating') // pre-generation check emits this
    expect(phaseTypes).not.toContain('generating-graphs')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// C4: Generated Lua syntax validity — full pipeline output verified by luac
// ─────────────────────────────────────────────────────────────────────────────

describe('C4: full pipeline Lua syntax validity (luac)', () => {
  it('complex orchestrator fixture produces syntactically valid Lua', async () => {
    const fixture = createComplexOrchestratorFixture()
    await setupOrchestratorMocks(fixture)

    const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: PROJECT_PATH,
    })

    const initLua = requireSuccessfulInitLua(result)
    await assertLuaSyntaxValid(initLua)
    assertBlocksBalanced(initLua)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// C5: Generated Lua block balance — callable + startup + sections
// ─────────────────────────────────────────────────────────────────────────────

describe('C5: Lua block balance — callable + startup + all sections', () => {
  it('complex fixture output has balanced block structure', async () => {
    const fixture = createComplexOrchestratorFixture()
    await setupOrchestratorMocks(fixture)

    const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: PROJECT_PATH,
    })

    const initLua = requireSuccessfulInitLua(result)
    assertBlocksBalanced(initLua)

    // Also verify the raw balance result has non-zero openers (code was generated)
    const balance = checkLuaBlockBalance(initLua)
    expect(balance.balanced).toBe(true)
    expect(balance.openers).toBeGreaterThan(0)
    expect(balance.openers).toBe(balance.closers)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// C6: Callable graph output structure — registry + callable section + startup ordering
// ─────────────────────────────────────────────────────────────────────────────

describe('C6: callable graph output structure', () => {
  it('callable graph: registry initialized, callable section before plugins, startup after callables', async () => {
    // Callable graph with entry + return
    const callableGraph = new GraphBuilder('Helper', 'c6-callable')
      .callableEntry('entry', [createCallablePort('msg', 'Message', 'string')])
      .action('process', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo "processed"',
        selectedActionKey: '',
        paramValues: {},
      })
      .returnNode('ret', [createCallablePort('result', 'Result', 'string')])
      .connectExec('entry', 'process')
      .connectExec('process', 'ret')
      .withOrder(0)
      .build()

    // Startup graph that references the callable via graph-ref
    const startupGraph = new GraphBuilder('Startup', 'c6-startup')
      .startupTrigger('entry')
      .graphRef('callHelper', 'c6-callable')
      .connectExec('entry', 'callHelper')
      .withOrder(1)
      .build()

    await setupOrchestratorMocks({
      graphs: [callableGraph, startupGraph],
    })

    const result = await generateInitLuaOrchestrator(PROJECT_PATH, {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: PROJECT_PATH,
    })

    const lua = requireSuccessfulInitLua(result)
    const lines = lua.split('\n')

    // 1. Registry initialization must be present
    const registryInitIdx = lines.findIndex((l) =>
      l.includes('_G._vinela_callables'),
    )
    expect(registryInitIdx).toBeGreaterThan(-1)

    // 2. Canonical 'Section: callable-functions' marker must appear after registry init
    const callableDefIdx = lines.findIndex((l) =>
      l.includes('Section: callable-functions'),
    )
    expect(callableDefIdx).toBeGreaterThan(registryInitIdx)

    // 3. Startup execution must come after callable definitions
    //    Anchored to the canonical 'Startup Execution' comment from emitStartupSection
    const startupIdx = lines.findIndex((l) => l.includes('Startup Execution'))
    expect(startupIdx).toBeGreaterThan(-1)
    expect(startupIdx).toBeGreaterThan(callableDefIdx)
  })
})
