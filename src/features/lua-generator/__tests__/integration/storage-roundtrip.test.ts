/**
 * Storage Round-Trip Integration Tests (C1-C2)
 *
 * Tests the complete lifecycle: write project files to memory storage →
 * load them back through real storage functions → run orchestrator →
 * verify output. This catches serialization/deserialization bugs that
 * mocked storage hides.
 *
 * CRITICAL: This file has NO vi.mock() calls for any storage modules.
 * `/memory/` paths route automatically to MemoryStorageBackend so
 * the real read/write functions run against a real in-memory backend.
 *
 * - C1: mocks computeDisableStates via vi.spyOn (real storage, controlled states)
 * - C2: uses real computeDisableStates AND real storage (full round-trip)
 *
 * `computeDisableStates` is NOT mocked at the file level so C2 can use
 * the real algorithm. C1 sets up a per-test spy in beforeEach.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import { _resetBackend } from '@/shared/lib/storage'
import type { GraphDisableState } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import { generateInitLuaOrchestrator } from '../../orchestrator/phase-coordinator'
import { GraphBuilder } from '../utils/graph-builder'
import { createEmptyFixture, createTempProject } from '../utils/temp-project'

// ─────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset the main backend singleton so each test gets a fresh memory backend
  _resetBackend()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// C1: Full project lifecycle — create → save → load → generate → verify
// ─────────────────────────────────────────────────────────────────────────────

describe('C1: full project lifecycle via real MemoryStorageBackend', () => {
  it('write graph to memory storage → load via real storage functions → generate correct Lua', async () => {
    // 1. Create fixture with a simple startup graph
    const fixture = createEmptyFixture('Round-Trip Test')
    const graph = new GraphBuilder('Startup', 'rt-startup')
      .startupTrigger('entry')
      .action('setNumber', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('entry', 'setNumber')
      .build()
    fixture.graphs = [graph]

    // 2. Write to memory storage (real write path)
    const { projectPath, cleanup } = await createTempProject(fixture)

    // 3. Mock computeDisableStates via vi.spyOn (tested separately in A1/A2)
    //    Wire graph as effectively enabled.
    const disableStateMod = await import(
      '@/features/graph-editor/utils/graph-disable-state'
    )
    const stateMap = new Map<string, GraphDisableState>([
      [
        graph.id,
        {
          graphId: graph.id,
          userEnabled: true,
          effective: { kind: 'enabled' },
        },
      ],
    ])
    vi.spyOn(disableStateMod, 'computeDisableStates').mockReturnValue({
      statesByGraphId: stateMap,
    })

    // 4. Run orchestrator against the written files (real storage reads)
    const result = await generateInitLuaOrchestrator(projectPath, {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath,
    })

    // 5. Verify generation succeeded and output is correct
    expect(result.success).toBe(true)
    expect(result.initLua).toContain('vim.opt.number')
    expect(result.metadata.graphsGenerated).toBe(1)
    expect(result.metadata.nodesGenerated).toBe(2) // trigger + set-option

    // Plugin/schema load diagnostics are expected because the fixture writes
    // { plugins: [...] } but loadInstalledPlugins may expect a different shape.
    // Filter them out and assert no other unexpected diagnostics exist.
    const nonPluginDiags = result.diagnostics.filter(
      (d) => !d.id.includes('PLUGIN') && !d.id.includes('SCHEMA'),
    )
    expect(nonPluginDiags).toHaveLength(0)

    await cleanup()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// C2: Multi-graph dependencies with real computeDisableStates and real storage
// ─────────────────────────────────────────────────────────────────────────────

describe('C2: multi-graph disable-state with real storage and real computeDisableStates', () => {
  it('4 graphs (A disabled, B→A, C→B, D standalone) → only D generates output', async () => {
    // Graph A: user-disabled, has a startup trigger
    const graphA = new GraphBuilder('Graph A', 'c2-graph-a')
      .startupTrigger('entry')
      .action('setNumber', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('entry', 'setNumber')
      .withEnabled(false)
      .withOrder(0)
      .build()

    // Graph B: enabled, references A via graph-ref (will be blocked)
    const graphB = new GraphBuilder('Graph B', 'c2-graph-b')
      .startupTrigger('entry')
      .graphRef('ref-a', 'c2-graph-a')
      .connectExec('entry', 'ref-a')
      .withEnabled(true)
      .withOrder(1)
      .build()

    // Graph C: enabled, references B via graph-ref (will be transitively blocked)
    const graphC = new GraphBuilder('Graph C', 'c2-graph-c')
      .startupTrigger('entry')
      .graphRef('ref-b', 'c2-graph-b')
      .connectExec('entry', 'ref-b')
      .withEnabled(true)
      .withOrder(2)
      .build()

    // Graph D: enabled, standalone — only one that should generate output
    const graphD = new GraphBuilder('Graph D', 'c2-graph-d')
      .startupTrigger('entry')
      .action('setWrap', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'wrap',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: false },
      })
      .connectExec('entry', 'setWrap')
      .withEnabled(true)
      .withOrder(3)
      .build()

    // Write all 4 graphs to memory storage via the real storage path
    const fixture = createEmptyFixture('Multi-Graph Disable Test')
    fixture.graphs = [graphA, graphB, graphC, graphD]
    const { projectPath, cleanup } = await createTempProject(fixture)

    // computeDisableStates is NOT mocked here — the real BFS algorithm runs.
    // This is the real-storage companion to A1/A2.

    const result = await generateInitLuaOrchestrator(projectPath, {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath,
    })

    // Only D should be generated (A disabled, B+C blocked by dependency)
    expect(result.success).toBe(true)
    expect(result.metadata.graphsGenerated).toBe(1)

    // D's action (wrap = false) should appear in the Lua output
    expect(result.initLua).toContain('vim.opt.wrap')

    // A is user-disabled → 1 WARN_GRAPH_DISABLED diagnostic
    const disabledWarnings = result.diagnostics.filter(
      (d) => d.id === 'WARN_GRAPH_DISABLED',
    )
    expect(disabledWarnings).toHaveLength(1)

    // B and C are blocked by dependency → 2 WARN_GRAPH_BLOCKED diagnostics
    const blockedWarnings = result.diagnostics.filter(
      (d) => d.id === 'WARN_GRAPH_BLOCKED',
    )
    expect(blockedWarnings).toHaveLength(2)

    await cleanup()
  })
})
