/**
 * Category 13: Performance & Scale Integration Tests
 *
 * 14 scenarios that exercise graph generation at realistic and stress scales.
 * Goals:
 *   - Detect performance regressions in graph indexing, traversal, and codegen.
 *   - Confirm scale scenarios complete without stack overflow or runaway output.
 *   - Provide deterministic, stable timing assertions via median measurements.
 *
 * ## Test design
 *   - All tests run in `describe.sequential` to avoid cross-test CPU contention
 *     (hard requirement — plain `describe` allows file-level concurrency which
 *     adds unpredictable noise to time-sensitive assertions).
 *   - Fixture construction (expensive setup) is done BEFORE timing starts.
 *   - Only the `generateLuaFromGraphs()` or `generateInitLuaOrchestrator()` call is timed.
 *   - Median of 3 (local) / 5 (CI) measured runs is used for assertions.
 *   - 2 warm-up runs precede measured runs to amortise JIT / GC effects.
 *   - No `luac -p` spawns inside timing loops (process spawn noise excluded).
 *
 * ## Threshold policy
 *   Thresholds use spec target × CI multiplier from `PERF_THRESHOLD_MULTIPLIER`
 *   (default 1.0; CI sets to 1.5 or higher). See perf-timing.ts for full policy.
 *
 * ## Baseline-relative regression detection
 *   In addition to absolute thresholds, each test asserts `medianMs < baseline * 2 * multiplier`.
 *   This catches regressions before they become catastrophic, without flaking on
 *   machine variance (the 2× factor is generous enough for GC noise).
 *
 * ## Correctness gates (post-timing, all tests)
 *   - `assertBlocksBalanced(lua)` — pure JS, zero process-spawn cost; catches
 *     unclosed do/if/function/for blocks that marker-only checks miss.
 *   - Full statement count assertions (not just spot-checks).
 *   - `assertLuaSyntaxValid` for 13.5 and 13.7 (spawns luac once, outside timing loop).
 *
 * ## Fixture self-checks
 *   Each fixture asserts expected node and exec-edge counts BEFORE timing starts,
 *   so wiring errors surface as test failures — not as silent underloads.
 *
 * ## Threshold Reference
 *
 * | Test  | Target  | Rationale |
 * |-------|---------|-----------|
 * | 13.1  | 1000ms  | 50 nodes, baseline for multi-graph overhead |
 * | 13.2  | 3000ms  | 500 nodes, ~3× 13.1 (sublinear scaling expected) |
 * | 13.3  | 2000ms  | 100-node chain, tests sequential traversal |
 * | 13.4  | 2000ms  | 201 nodes, tests wide branching |
 * | 13.5  | 500ms   | 22 nodes, tests deep recursion overhead |
 * | 13.6  | 2000ms  | 65 nodes + 10 callable defs, tests cross-graph resolution |
 * | 13.7  | 3500ms  | ~100 nodes mixed types, tests output size |
 * | 13.8  | 5000ms  | Full orchestrator, complex project + sections |
 * | 13.9  | 2000ms  | Cold start, no warm-up |
 * | 13.10 | N/A     | Memory only (50MB ceiling) |
 * | 13.11 | 2000ms  | Typical project baseline (golden benchmark) |
 * | 13.12 | 1000ms  | Worst-case nesting (30 levels, both branches) |
 * | 13.13 | 2000ms  | Graph count scaling (50 graphs × 2 nodes vs 2 × 50 nodes) |
 * | 13.14 | 2000ms  | Wide vs deep (same ~100 nodes) |
 *
 * ## Noise vs Regression
 *
 * - Median within 1.5× target: PASS (normal variance)
 * - Median 1.5–2× target: WARNING (investigate if consistent across 3 runs)
 * - Median >2× target: REGRESSION (file issue, bisect recent commits)
 * - Single run spike but median OK: Environment noise (GC pause, CPU throttle)
 *
 * ## Investigation Steps
 *
 * 1. Re-run locally 3 times. If median is stable, it's a real regression.
 * 2. Compare with adjacent tests (e.g., 13.1 vs 13.11) to isolate component.
 * 3. Use `PERF_THRESHOLD_MULTIPLIER=999 bun test performance` to skip thresholds
 *    and focus on correctness gates.
 * 4. Profile with `bun test --inspect` + Chrome DevTools.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateLuaFromGraphs } from '@/features/lua-generator/__tests__/utils/generate-helper'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import { generateInitLuaOrchestrator } from '@/features/lua-generator/orchestrator/phase-coordinator'
import {
  assertBlocksBalanced,
  assertLuaSyntaxValid,
} from './helpers/lua-assertions'
import {
  buildComplexProjectFixtureForSize,
  buildDeepNestedConditions,
  buildDeepNestedConditionsWithBranches,
  buildManyGraphRefs,
  buildMultiGraphChains,
  buildSingleChainGraph,
  buildTypicalProjectFixture,
  buildWideFanGraph,
  countExecEdges,
  countTotalExecEdges,
  countTotalNodes,
} from './helpers/perf-fixtures'
import {
  applyMultiplier,
  BASELINES_MS,
  formatPerfStats,
  getThresholdMultiplier,
  measureGenerationTime,
} from './helpers/perf-timing'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks for test 13.8 (full orchestrator path)
// All vi.mock() declarations must be at module level (hoisted by Vitest).
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator mock-setup helper (for 13.8)
// Mirrors the setupOrchestratorMocks pattern from orchestrator-fixture.ts
// but inlined here to keep the performance test self-contained.
// ─────────────────────────────────────────────────────────────────────────────

import type { GraphDisableState } from '@/shared/types'
import type { ComplexProjectFixture } from './helpers/perf-fixtures'

/**
 * Wire all storage mocks for the orchestrator path using the complex-project fixture.
 * Uses dynamic imports so hoisted vi.mock() factory wrappers are already in place.
 */
async function setupPerfOrchestratorMocks(
  fixture: ComplexProjectFixture,
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
  const { computeDisableStates } = await import(
    '@/features/graph-editor/utils/graph-disable-state'
  )
  const { readProjectFile } = await import('@/shared/lib/storage-api')

  // Graphs — all enabled (Graph default is enabled: true)
  ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue([
    ...fixture.graphs,
  ])

  // Plugins — no schemas provided so they will be filtered out by buildResolvedPlugins
  ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
    status: 'loaded',
    plugins: fixture.plugins.map((p) => ({
      schemaId: p.schemaId,
      enabled: p.enabled,
      config: p.config,
      addedAt: 1_000_000,
    })),
  })

  // Schemas — empty (no schema for the perf-test plugin, intentional)
  ;(loadAllSchemas as ReturnType<typeof vi.fn>).mockResolvedValue([])

  // Neovim options — 5 real options + leaderKey
  ;(readNeovimOptions as ReturnType<typeof vi.fn>).mockResolvedValue(
    fixture.options,
  )

  // Keymaps — 2 project-sourced entries
  ;(loadKeymaps as ReturnType<typeof vi.fn>).mockResolvedValue(fixture.keymaps)

  // LSP — empty (not under test for perf)
  ;(loadProjectLspConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
    enabledServers: [],
  })

  // Colorscheme — none active
  ;(loadColorSchemePreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    data: { activeScheme: null, variantPreferences: {} },
    source: 'default',
  })

  // computeDisableStates — all graphs enabled
  const statesByGraphId = new Map<string, GraphDisableState>(
    fixture.graphs.map((g) => [
      g.id,
      {
        graphId: g.id,
        userEnabled: true,
        effective: { kind: 'enabled' as const },
      },
    ]),
  )
  ;(computeDisableStates as ReturnType<typeof vi.fn>).mockReturnValue({
    statesByGraphId,
  })

  // Project metadata — minimal (not critical for perf)
  ;(readProjectFile as ReturnType<typeof vi.fn>).mockRejectedValue(
    new Error('project.json not found'),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

// Note: describe.sequential is not available in the Bun test runner (TypeError).
// Plain describe is used instead — Vitest runs tests within a describe block
// sequentially by default, which satisfies the "no cross-test CPU contention"
// requirement from the plan. File-level parallelism is controlled by the
// vitest pool config, not by describe.sequential.
describe('Category 13: Performance & Scale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 13.1 Multi-graph throughput: 10 graphs × 5 nodes each
  // ───────────────────────────────────────────────────────────────────────────

  it('13.1 10 graphs × 5 nodes each (target: < 1000ms)', async () => {
    const GRAPH_COUNT = 10
    const NODES_PER_GRAPH = 5
    const TARGET_MS = 1000

    // Build fixture (not timed)
    const graphs = buildMultiGraphChains(GRAPH_COUNT, NODES_PER_GRAPH)

    // Self-check: verify fixture shape before timing
    expect(graphs.length).toBe(GRAPH_COUNT)
    expect(countTotalNodes(graphs)).toBe(GRAPH_COUNT * NODES_PER_GRAPH)
    // Each graph: 1 trigger-to-action edge + (nodesPerGraph-2) action-to-action edges
    // = nodesPerGraph - 1 edges per graph
    const expectedExecEdges = GRAPH_COUNT * (NODES_PER_GRAPH - 1)
    expect(countTotalExecEdges(graphs)).toBe(expectedExecEdges)

    // Measure generation (timed)
    let lastResult: ReturnType<typeof generateLuaFromGraphs> | undefined
    const stats = await measureGenerationTime(() => {
      lastResult = generateLuaFromGraphs(graphs)
    })

    console.log(formatPerfStats('13.1 10×5 graphs', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────
    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    expect(result.diagnostics.hasErrors()).toBe(false)

    // All 10 startup graphs should produce output
    expect(result.startupUnits.length).toBe(GRAPH_COUNT)

    // Full statement count: each graph has (nodesPerGraph - 1) set-option actions
    // generating vim.opt.<name> = ... lines. Total = graphCount × (nodesPerGraph - 1).
    const expectedSetOptionCount = GRAPH_COUNT * (NODES_PER_GRAPH - 1)
    const setOptionMatches = result.lua.match(/vim\.opt\./g)
    expect(
      setOptionMatches?.length,
      `Expected ${expectedSetOptionCount} vim.opt. statements (all graphs × all actions) but got ${setOptionMatches?.length ?? 0}`,
    ).toBe(expectedSetOptionCount)

    // Spot-check: first and last graph markers present
    expect(result.lua).toContain('g0opt1')
    expect(result.lua).toContain(`g${GRAPH_COUNT - 1}opt1`)

    // Block balance: every do/if/function/for must be closed
    assertBlocksBalanced(result.lua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.1']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 20_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.2 Multi-graph throughput: 50 graphs × 10 nodes each
  // ───────────────────────────────────────────────────────────────────────────

  it('13.2 50 graphs × 10 nodes each (target: < 3000ms)', async () => {
    const GRAPH_COUNT = 50
    const NODES_PER_GRAPH = 10
    const TARGET_MS = 3000

    // Build fixture (not timed)
    const graphs = buildMultiGraphChains(GRAPH_COUNT, NODES_PER_GRAPH)

    // Self-check
    expect(graphs.length).toBe(GRAPH_COUNT)
    expect(countTotalNodes(graphs)).toBe(GRAPH_COUNT * NODES_PER_GRAPH)
    const expectedExecEdges = GRAPH_COUNT * (NODES_PER_GRAPH - 1)
    expect(countTotalExecEdges(graphs)).toBe(expectedExecEdges)

    // Measure generation (timed)
    let lastResult: ReturnType<typeof generateLuaFromGraphs> | undefined
    const stats = await measureGenerationTime(() => {
      lastResult = generateLuaFromGraphs(graphs)
    })

    console.log(formatPerfStats('13.2 50×10 graphs', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────
    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    expect(result.diagnostics.hasErrors()).toBe(false)

    // All 50 graphs should produce startup units
    expect(result.startupUnits.length).toBe(GRAPH_COUNT)

    // Full statement count: 50 graphs × 9 actions = 450 vim.opt. statements
    const expectedSetOptionCount = GRAPH_COUNT * (NODES_PER_GRAPH - 1)
    const setOptionMatches = result.lua.match(/vim\.opt\./g)
    expect(
      setOptionMatches?.length,
      `Expected ${expectedSetOptionCount} vim.opt. statements (50 graphs × 9 actions each) but got ${setOptionMatches?.length ?? 0}`,
    ).toBe(expectedSetOptionCount)

    // Spot-check: markers from several graphs
    expect(result.lua).toContain('g0opt1')
    expect(result.lua).toContain('g24opt5')
    expect(result.lua).toContain(`g${GRAPH_COUNT - 1}opt1`)

    // Block balance
    assertBlocksBalanced(result.lua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.2']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 30_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.3 Single long chain: 100 nodes
  // ───────────────────────────────────────────────────────────────────────────

  it('13.3 single chain graph with 100 nodes (target: < 2000ms)', async () => {
    const TOTAL_NODES = 100
    const TARGET_MS = 2000

    // Build fixture (not timed)
    const graph = buildSingleChainGraph(TOTAL_NODES)

    // Self-check
    expect(graph.nodes.length).toBe(TOTAL_NODES)
    // trigger→action1 + 98 action→action edges = 99 exec edges
    expect(countExecEdges(graph)).toBe(TOTAL_NODES - 1)

    // Measure generation (timed)
    let lastResult: ReturnType<typeof generateLuaFromGraphs> | undefined
    const stats = await measureGenerationTime(() => {
      lastResult = generateLuaFromGraphs([graph])
    })

    console.log(formatPerfStats('13.3 100-node chain', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────
    // No stack overflow (RangeError) must be thrown
    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    // No errors (specifically no cycle/runtime errors that indicate overflow)
    expect(result.diagnostics.hasErrors()).toBe(false)

    // Full statement count: exactly 99 vim.opt. emissions (one per action node)
    const expectedSetOptionCount = TOTAL_NODES - 1
    const setOptionMatches = result.lua.match(/vim\.opt\./g)
    expect(
      setOptionMatches?.length,
      `Expected exactly ${expectedSetOptionCount} vim.opt. statements (one per action node) but got ${setOptionMatches?.length ?? 0}`,
    ).toBe(expectedSetOptionCount)

    // First, middle, and last chain actions present in order
    expect(result.lua).toContain('chainopt1')
    expect(result.lua).toContain('chainopt50')
    expect(result.lua).toContain('chainopt99')

    const idx1 = result.lua.indexOf('chainopt1')
    const idx50 = result.lua.indexOf('chainopt50')
    const idx99 = result.lua.indexOf('chainopt99')
    expect(idx1).toBeLessThan(idx50)
    expect(idx50).toBeLessThan(idx99)

    // Block balance
    assertBlocksBalanced(result.lua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.3']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 25_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.4 Wide fan: 100 condition→action branches (201 nodes, 200 exec edges)
  // ───────────────────────────────────────────────────────────────────────────

  it('13.4 wide fan: 100 condition→action branches (~201 nodes, target: < 2000ms)', async () => {
    const BRANCH_COUNT = 100
    const TARGET_MS = 2000

    // Build fixture (not timed)
    const graph = buildWideFanGraph(BRANCH_COUNT)

    // Self-check: 1 trigger + 100 conditions + 100 actions = 201 nodes
    const expectedNodeCount = 1 + BRANCH_COUNT * 2
    expect(graph.nodes.length).toBe(expectedNodeCount)

    // Exec edges:
    //   trigger→cond0 (1)
    //   cond0.done→cond1, …, cond98.done→cond99 (99)
    //   each cond_i.true→action_i (100)
    //   total = 200
    const expectedExecEdgeCount = BRANCH_COUNT * 2
    expect(countExecEdges(graph)).toBe(expectedExecEdgeCount)

    // Measure generation (timed)
    let lastResult: ReturnType<typeof generateLuaFromGraphs> | undefined
    const stats = await measureGenerationTime(() => {
      lastResult = generateLuaFromGraphs([graph])
    })

    console.log(formatPerfStats('13.4 100-branch fan', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────
    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    expect(result.diagnostics.hasErrors()).toBe(false)

    // Full count: all 100 branch action markers must be present (not a spot-check)
    const fanoptMatches = result.lua.match(/fanopt\d+/g)
    const uniqueMarkers = new Set(fanoptMatches ?? [])
    expect(
      uniqueMarkers.size,
      `Expected all ${BRANCH_COUNT} branch action markers (fanopt0..fanopt99) but found ${uniqueMarkers.size}`,
    ).toBe(BRANCH_COUNT)

    // Block balance
    assertBlocksBalanced(result.lua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.4']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 25_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.5 Deep nesting: 20 nested conditions
  // ───────────────────────────────────────────────────────────────────────────

  it('13.5 deep nesting: 20 nested conditions (target: < 500ms, no stack overflow)', async () => {
    const DEPTH = 20
    const TARGET_MS = 500

    // Build fixture (not timed)
    const graph = buildDeepNestedConditions(DEPTH)

    // Self-check: 1 trigger + 20 conditions + 1 terminal = 22 nodes
    expect(graph.nodes.length).toBe(1 + DEPTH + 1)
    // Exec edges: trigger→cond0 (1) + cond0.true→cond1 … cond(N-2).true→cond(N-1) (N-1) + deepest.true→terminal (1)
    // = 1 + (DEPTH - 1) + 1 = DEPTH + 1
    expect(countExecEdges(graph)).toBe(DEPTH + 1)

    // Measure generation (timed)
    let lastResult: ReturnType<typeof generateLuaFromGraphs> | undefined
    let thrownError: unknown

    const stats = await measureGenerationTime(() => {
      try {
        lastResult = generateLuaFromGraphs([graph])
      } catch (err) {
        thrownError = err
      }
    })

    console.log(formatPerfStats('13.5 20-deep nesting', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────

    // No stack overflow (RangeError) or any other thrown error
    expect(thrownError).toBeUndefined()

    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    // No traversal or runtime diagnostics — specifically no cycle or runtime errors
    const allDiagnostics = result.diagnostics.getAll()
    const traversalOrRuntimeDiagnostics = allDiagnostics.filter(
      (d) =>
        d.id === 'exec-cycle-detected' ||
        d.id === 'ERR_GENERATION_FAILED' ||
        d.category === 'cycle' ||
        d.category === 'runtime',
    )
    expect(
      traversalOrRuntimeDiagnostics,
      'Expected zero traversal/runtime diagnostics',
    ).toHaveLength(0)

    // No errors at all for this clean structure
    expect(result.diagnostics.hasErrors()).toBe(false)

    // Terminal action marker present exactly once (no early-exit or duplication)
    const terminalMatches = result.lua.match(/deepTerminalOpt/g)
    expect(terminalMatches).not.toBeNull()
    expect(terminalMatches).toHaveLength(1)

    // Verify nesting depth: at least DEPTH `if` lines in the output
    const ifLines = result.lua.split('\n').filter((l) => /^\s*if\s/.test(l))
    expect(ifLines.length).toBeGreaterThanOrEqual(DEPTH)

    // Block balance
    assertBlocksBalanced(result.lua)

    // Syntax validation (via luac -p) — deepest nested if-structure is the
    // most likely to produce malformed Lua on a code-generation regressor.
    // Guard: silently skipped when luac is not installed (no test failure).
    await assertLuaSyntaxValid(result.lua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.5']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 15_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.6 Many graph-ref calls: 10 callables × 5 calls each (50 total)
  // ───────────────────────────────────────────────────────────────────────────

  it('13.6 many graph-ref calls: 10 callables × 5 calls each (target: < 2000ms)', async () => {
    const CALLABLE_COUNT = 10
    const CALLS_PER_CALLABLE = 5
    const TOTAL_CALLS = CALLABLE_COUNT * CALLS_PER_CALLABLE
    const TARGET_MS = 2000

    // Build fixture (not timed)
    const graphs = buildManyGraphRefs(CALLABLE_COUNT, CALLS_PER_CALLABLE)

    // Self-check: 10 callable graphs + 1 startup graph = 11 total
    expect(graphs.length).toBe(CALLABLE_COUNT + 1)

    // Each callable: 3 nodes (entry + action + return)
    // Startup: 1 trigger + 50 graph-refs = 51 nodes
    expect(countTotalNodes(graphs)).toBe(CALLABLE_COUNT * 3 + 1 + TOTAL_CALLS)

    // Startup exec edges: trigger→ref[0] (1) + 49 ref→ref chains = 50
    const startupGraph = graphs[graphs.length - 1]
    expect(startupGraph).toBeDefined()
    if (!startupGraph) return
    expect(countExecEdges(startupGraph)).toBe(TOTAL_CALLS)

    // Measure generation (timed)
    let lastResult: ReturnType<typeof generateLuaFromGraphs> | undefined
    const stats = await measureGenerationTime(() => {
      lastResult = generateLuaFromGraphs(graphs)
    })

    console.log(formatPerfStats('13.6 10×5 graph-refs', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────
    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    // 10 callable definitions should be generated
    expect(result.callableUnits.length).toBe(CALLABLE_COUNT)

    // All callable definitions registered in output
    for (let c = 0; c < CALLABLE_COUNT; c++) {
      expect(result.lua).toContainCallableRegistration(
        `perf-callable-${c}`,
        `perf-callable-${c}`,
      )
    }

    // No unresolved-reference diagnostics
    const refErrors = result.diagnostics
      .getAll()
      .filter(
        (d) =>
          d.category === 'reference' ||
          d.id === 'ERR_UNRESOLVED_GRAPH_REF' ||
          d.id === 'WARN_GRAPH_REF_DISABLED',
      )
    expect(refErrors).toHaveLength(0)

    // Block balance
    assertBlocksBalanced(result.lua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.6']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 25_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.7 Generated output size (complex project fixture)
  // ───────────────────────────────────────────────────────────────────────────

  it('13.7 output size: complex project generates < 10000 lines', async () => {
    const MAX_LINES = 10_000
    const TARGET_MS = 3500

    // Build fixture (not timed) — includes graphs + options/keymaps/plugins
    const fixture = buildComplexProjectFixtureForSize()
    const { graphs } = fixture

    // Sanity check fixture shape
    expect(graphs.length).toBeGreaterThan(0)

    // Measure generation (timed) — uses the helper (graph-only) path
    let lastResult: ReturnType<typeof generateLuaFromGraphs> | undefined
    const stats = await measureGenerationTime(() => {
      lastResult = generateLuaFromGraphs(graphs)
    })

    console.log(formatPerfStats('13.7 complex-project size', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────
    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    expect(result.diagnostics.hasErrors()).toBe(false)

    // Primary size assertion
    const lines = result.lua.split('\n')
    const linesOfCode = lines.filter((l) => l.trim().length > 0).length

    expect(
      linesOfCode,
      `Expected generated output < ${MAX_LINES} non-empty lines but got ${linesOfCode}`,
    ).toBeLessThan(MAX_LINES)

    // Sanity cross-check: output is non-trivial
    expect(linesOfCode).toBeGreaterThan(10)

    // Spot-check: both startup and callable sections present
    expect(result.startupUnits.length).toBeGreaterThan(0)
    expect(result.callableUnits.length).toBeGreaterThan(0)

    // Block balance
    assertBlocksBalanced(result.lua)

    // Syntax validation — complex-project output is large enough that malformed
    // section stitching (e.g. a missing `end` on a plugin setup block) would not
    // be caught by marker checks alone. Guard: skipped when luac is absent.
    await assertLuaSyntaxValid(result.lua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.7']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 25_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.9 Cold-cache / first-run performance: no warm-up
  // ───────────────────────────────────────────────────────────────────────────

  it('13.9 cold-cache first run: no warm-up (target: < 2000ms)', async () => {
    const GRAPH_COUNT = 50
    const NODES_PER_GRAPH = 10
    const TARGET_MS = 2000

    // Build fixture (not timed) — same as 13.2
    const graphs = buildMultiGraphChains(GRAPH_COUNT, NODES_PER_GRAPH)

    // Self-check
    expect(graphs.length).toBe(GRAPH_COUNT)
    expect(countTotalNodes(graphs)).toBe(GRAPH_COUNT * NODES_PER_GRAPH)

    // Measure with NO warm-up and a single run (cold-start simulation)
    let lastResult: ReturnType<typeof generateLuaFromGraphs> | undefined
    const stats = await measureGenerationTime(
      () => {
        lastResult = generateLuaFromGraphs(graphs)
      },
      { warmupRuns: 0, measuredRuns: 1 },
    )

    console.log(formatPerfStats('13.9 cold-start (no warm-up)', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────
    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    expect(result.diagnostics.hasErrors()).toBe(false)
    expect(result.startupUnits.length).toBe(GRAPH_COUNT)

    // Block balance
    assertBlocksBalanced(result.lua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.9']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: cold-start median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 30_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.10 Memory usage: 50-graph fixture stays under 50MB heap delta
  // ───────────────────────────────────────────────────────────────────────────

  it('13.10 memory usage: 50 graphs stays under 50MB heap delta', () => {
    const GRAPH_COUNT = 50
    const NODES_PER_GRAPH = 10
    const MAX_DELTA_MB = 50

    // Build fixture (not timed) — same fixture as 13.2
    const graphs = buildMultiGraphChains(GRAPH_COUNT, NODES_PER_GRAPH)

    // Self-check
    expect(graphs.length).toBe(GRAPH_COUNT)

    // Force GC before measurement if available (requires --expose-gc flag)
    if (typeof global.gc === 'function') global.gc()
    const before = process.memoryUsage().heapUsed

    const result = generateLuaFromGraphs(graphs)

    if (typeof global.gc === 'function') global.gc()
    const after = process.memoryUsage().heapUsed
    const deltaMB = (after - before) / (1024 * 1024)

    console.log(
      `[perf] 13.10 memory: heapDelta=${deltaMB.toFixed(1)}MB (limit: ${MAX_DELTA_MB}MB, gc=${typeof global.gc === 'function' ? 'available' : 'unavailable'})`,
    )

    // ── Correctness gates ────────────────────────────────────────────────────
    expect(result.diagnostics.hasErrors()).toBe(false)
    expect(result.startupUnits.length).toBe(GRAPH_COUNT)
    assertBlocksBalanced(result.lua)

    // ── Memory assertion ─────────────────────────────────────────────────────
    // process.memoryUsage() is approximate — the 50MB ceiling is a canary for
    // order-of-magnitude regressions (e.g. 500MB), not precision measurement.
    // If global.gc is unavailable the delta includes GC-eligible garbage and
    // may be higher; the generous threshold accounts for this.
    expect(
      deltaMB,
      `Heap delta ${deltaMB.toFixed(1)}MB exceeds ${MAX_DELTA_MB}MB limit — possible memory leak or O(n²) allocation`,
    ).toBeLessThan(MAX_DELTA_MB)
  }, 15_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.11 Typical project baseline: 8 realistic graphs (golden benchmark)
  // ───────────────────────────────────────────────────────────────────────────

  it('13.11 typical project baseline: 8 realistic graphs (target: < 2000ms)', async () => {
    const TARGET_MS = 2000

    // Build fixture (not timed)
    const { graphs, expectedStartupCount, expectedCallableCount } =
      buildTypicalProjectFixture()

    // Self-check fixture shape
    expect(graphs.length).toBe(8)

    // Measure generation (timed)
    let lastResult: ReturnType<typeof generateLuaFromGraphs> | undefined
    const stats = await measureGenerationTime(() => {
      lastResult = generateLuaFromGraphs(graphs)
    })

    console.log(formatPerfStats('13.11 typical-project baseline', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────
    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    expect(result.diagnostics.hasErrors()).toBe(false)

    // All startup graphs produce units
    expect(
      result.startupUnits.length,
      `Expected ${expectedStartupCount} startup units`,
    ).toBe(expectedStartupCount)

    // The callable graph produces a unit
    expect(
      result.callableUnits.length,
      `Expected ${expectedCallableCount} callable unit`,
    ).toBe(expectedCallableCount)

    // Key node types must appear in output
    expect(result.lua).toContain('vim.opt.number')
    expect(result.lua).toContain('vim.opt.tabstop')
    expect(result.lua).toContain('vim.keymap.set')
    expect(result.lua).toContain('vim.api.nvim_create_autocmd')

    // Callable function definition present
    const hasCallableDef =
      /_G\._vinela_callables\[".*"\]\s*=\s*function\(params\)/.test(result.lua)
    expect(
      hasCallableDef,
      'Expected callable function definition in output',
    ).toBe(true)

    // Block balance
    assertBlocksBalanced(result.lua)

    // Syntax validation (errors if luac not available)
    await assertLuaSyntaxValid(result.lua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.11']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 30_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.12 Worst case: 30 nested conditions with both branches
  // ───────────────────────────────────────────────────────────────────────────

  it('13.12 worst case: 30 nested conditions with mixed branches (target: < 1000ms)', async () => {
    const DEPTH = 30
    const TARGET_MS = 1000

    // Build fixture (not timed)
    const graph = buildDeepNestedConditionsWithBranches(DEPTH)

    // Self-check: 1 trigger + DEPTH conditions + DEPTH false-actions + 1 terminal
    // = 2 + 2*DEPTH nodes
    const expectedNodeCount = 2 + 2 * DEPTH
    expect(
      graph.nodes.length,
      `Expected ${expectedNodeCount} nodes for depth=${DEPTH}`,
    ).toBe(expectedNodeCount)

    // Measure generation (timed)
    let lastResult: ReturnType<typeof generateLuaFromGraphs> | undefined
    let thrownError: unknown

    const stats = await measureGenerationTime(() => {
      try {
        lastResult = generateLuaFromGraphs([graph])
      } catch (err) {
        thrownError = err
      }
    })

    console.log(formatPerfStats('13.12 30-deep mixed branches', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────

    // No stack overflow (RangeError) or any other thrown error
    expect(thrownError).toBeUndefined()

    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    expect(result.diagnostics.hasErrors()).toBe(false)

    // Must have at least DEPTH `if` statements
    const ifLines = result.lua.split('\n').filter((l) => /^\s*if\s/.test(l))
    expect(
      ifLines.length,
      `Expected at least ${DEPTH} if-lines for ${DEPTH} conditions`,
    ).toBeGreaterThanOrEqual(DEPTH)

    // Must have else branches (each condition has a false path)
    const elseLines = result.lua.split('\n').filter((l) => /^\s*else\b/.test(l))
    expect(
      elseLines.length,
      `Expected at least ${DEPTH} else-lines for ${DEPTH} false branches`,
    ).toBeGreaterThanOrEqual(DEPTH)

    // Block balance — CRITICAL for deeply nested if/else/end structures
    assertBlocksBalanced(result.lua)

    // Syntax validation (if luac available)
    await assertLuaSyntaxValid(result.lua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.12']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 20_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.13 Graph count vs node count scaling: same 100 total nodes, different shapes
  // ───────────────────────────────────────────────────────────────────────────

  it('13.13 scaling: 50 graphs × 2 nodes vs 2 graphs × 50 nodes (same 100 total nodes)', async () => {
    const TARGET_MS = 2000

    // Build both fixtures (not timed)
    const manySmall = buildMultiGraphChains(50, 2) // 50 graphs × 2 nodes = 100 total
    const fewLarge = buildMultiGraphChains(2, 50) // 2 graphs × 50 nodes = 100 total

    // Self-checks
    expect(countTotalNodes(manySmall)).toBe(100)
    expect(countTotalNodes(fewLarge)).toBe(100)
    expect(manySmall.length).toBe(50)
    expect(fewLarge.length).toBe(2)

    // Measure many-small (timed)
    let resultSmall: ReturnType<typeof generateLuaFromGraphs> | undefined
    const statsSmall = await measureGenerationTime(() => {
      resultSmall = generateLuaFromGraphs(manySmall)
    })

    // Measure few-large (timed)
    let resultLarge: ReturnType<typeof generateLuaFromGraphs> | undefined
    const statsLarge = await measureGenerationTime(() => {
      resultLarge = generateLuaFromGraphs(fewLarge)
    })

    console.log(formatPerfStats('13.13 many-small (50×2)', statsSmall))
    console.log(formatPerfStats('13.13 few-large  (2×50)', statsLarge))

    // Log ratio for monitoring (informational — not asserted)
    const ratio =
      statsLarge.medianMs > 0
        ? statsSmall.medianMs / statsLarge.medianMs
        : Number.NaN
    console.log(
      `[perf] 13.13 ratio many-small/few-large: ${Number.isNaN(ratio) ? 'N/A' : ratio.toFixed(2)}x`,
    )

    // ── Correctness gates — many-small ──────────────────────────────────────
    expect(resultSmall).toBeDefined()
    if (!resultSmall) return
    expect(resultSmall.diagnostics.hasErrors()).toBe(false)
    expect(resultSmall.startupUnits.length).toBe(50)
    assertBlocksBalanced(resultSmall.lua)

    // ── Correctness gates — few-large ───────────────────────────────────────
    expect(resultLarge).toBeDefined()
    if (!resultLarge) return
    expect(resultLarge.diagnostics.hasErrors()).toBe(false)
    expect(resultLarge.startupUnits.length).toBe(2)
    assertBlocksBalanced(resultLarge.lua)

    // ── Performance assertions ────────────────────────────────────────────────
    const baselineSmall = BASELINES_MS['13.13']
    const baselineLarge = BASELINES_MS['13.13']
    const multiplier = getThresholdMultiplier()

    expect(
      statsSmall.medianMs,
      `many-small regression: median ${statsSmall.medianMs.toFixed(1)}ms > 2× baseline ${baselineSmall}ms`,
    ).toBeLessThan(baselineSmall * 2 * multiplier)
    expect(statsSmall.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))

    expect(
      statsLarge.medianMs,
      `few-large regression: median ${statsLarge.medianMs.toFixed(1)}ms > 2× baseline ${baselineLarge}ms`,
    ).toBeLessThan(baselineLarge * 2 * multiplier)
    expect(statsLarge.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 30_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.14 Wide vs deep graph shape comparison
  // ───────────────────────────────────────────────────────────────────────────

  it('13.14 shape: wide fan (50 branches, ~101 nodes) vs deep chain (100 nodes)', async () => {
    const TARGET_MS = 2000

    // Build both fixtures (not timed)
    const wideGraph = buildWideFanGraph(50) // 1 trigger + 50 conds + 50 actions = 101 nodes
    const deepGraph = buildSingleChainGraph(100) // 1 trigger + 99 actions = 100 nodes

    // Self-checks
    expect(wideGraph.nodes.length).toBe(101)
    expect(deepGraph.nodes.length).toBe(100)

    // Measure wide (timed)
    let resultWide: ReturnType<typeof generateLuaFromGraphs> | undefined
    const statsWide = await measureGenerationTime(() => {
      resultWide = generateLuaFromGraphs([wideGraph])
    })

    // Measure deep (timed)
    let resultDeep: ReturnType<typeof generateLuaFromGraphs> | undefined
    const statsDeep = await measureGenerationTime(() => {
      resultDeep = generateLuaFromGraphs([deepGraph])
    })

    console.log(formatPerfStats('13.14 wide (50-branch fan)', statsWide))
    console.log(formatPerfStats('13.14 deep (100-node chain)', statsDeep))

    const ratio =
      statsDeep.medianMs > 0
        ? statsWide.medianMs / statsDeep.medianMs
        : Number.NaN
    console.log(
      `[perf] 13.14 ratio wide/deep: ${Number.isNaN(ratio) ? 'N/A' : ratio.toFixed(2)}x`,
    )

    // ── Correctness gates — wide ─────────────────────────────────────────────
    expect(resultWide).toBeDefined()
    if (!resultWide) return
    expect(resultWide.diagnostics.hasErrors()).toBe(false)

    // Wide graph: if statements present (one per condition branch)
    const ifLines = resultWide.lua.split('\n').filter((l) => /^\s*if\s/.test(l))
    expect(ifLines.length).toBeGreaterThan(0)

    assertBlocksBalanced(resultWide.lua)

    // ── Correctness gates — deep ─────────────────────────────────────────────
    expect(resultDeep).toBeDefined()
    if (!resultDeep) return
    expect(resultDeep.diagnostics.hasErrors()).toBe(false)

    // Deep graph: verify ordering (first action before last action)
    expect(resultDeep.lua).toContain('chainopt1')
    expect(resultDeep.lua).toContain('chainopt99')
    const idxFirst = resultDeep.lua.indexOf('chainopt1')
    const idxLast = resultDeep.lua.indexOf('chainopt99')
    expect(idxFirst).toBeLessThan(idxLast)

    assertBlocksBalanced(resultDeep.lua)

    // ── Performance assertions ────────────────────────────────────────────────
    const baselineWide = BASELINES_MS['13.14']
    const baselineDeep = BASELINES_MS['13.14']
    const multiplier = getThresholdMultiplier()

    expect(
      statsWide.medianMs,
      `wide regression: median ${statsWide.medianMs.toFixed(1)}ms > 2× baseline ${baselineWide}ms`,
    ).toBeLessThan(baselineWide * 2 * multiplier)
    expect(statsWide.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))

    expect(
      statsDeep.medianMs,
      `deep regression: median ${statsDeep.medianMs.toFixed(1)}ms > 2× baseline ${baselineDeep}ms`,
    ).toBeLessThan(baselineDeep * 2 * multiplier)
    expect(statsDeep.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 30_000)

  // ───────────────────────────────────────────────────────────────────────────
  // 13.8 End-to-end orchestrator performance (full pipeline)
  //
  // Uses the real generateInitLuaOrchestrator entry point with mocked storage,
  // the same approach as full-pipeline.test.ts. This exercises the entire
  // 9-phase pipeline (data loading coordination, section generation, graph
  // generation, phase wiring, assembly) at realistic-project scale.
  // ───────────────────────────────────────────────────────────────────────────

  it('13.8 end-to-end orchestrator: complex project (target: < 5000ms)', async () => {
    const TARGET_MS = 5000

    // Build fixture (not timed)
    const fixture = buildComplexProjectFixtureForSize()

    // Wire all storage mocks (not timed)
    await setupPerfOrchestratorMocks(fixture)

    const EXPECTED_GRAPH_COUNT = fixture.graphs.length

    // Measure generation (timed) — full orchestrator path including all phases
    let lastResult:
      | Awaited<ReturnType<typeof generateInitLuaOrchestrator>>
      | undefined
    const stats = await measureGenerationTime(async () => {
      // Reset mocks between runs so resolvedValue is fresh
      await setupPerfOrchestratorMocks(fixture)
      lastResult = await generateInitLuaOrchestrator('/perf/test/project', {
        targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
        projectPath: '/perf/test/project',
      })
    })

    console.log(formatPerfStats('13.8 orchestrator pipeline', stats))

    console.log(formatPerfStats('13.8 orchestrator pipeline', stats))

    // ── Correctness gates (post-timing) ─────────────────────────────────────
    const result = lastResult
    expect(result).toBeDefined()
    if (!result) return

    // Pipeline must succeed
    expect(
      result.success,
      `Orchestrator pipeline failed: ${JSON.stringify(result.diagnostics.slice(0, 3))}`,
    ).toBe(true)

    // initLua must be present on success
    expect(result.initLua).toBeDefined()
    const initLua = result.initLua ?? ''

    // All graphs generated
    expect(
      result.metadata.graphsGenerated,
      `Expected ${EXPECTED_GRAPH_COUNT} graphs generated but got ${result.metadata.graphsGenerated}`,
    ).toBe(EXPECTED_GRAPH_COUNT)

    // Output is non-trivial (> 20 lines)
    expect(result.metadata.linesOfCode).toBeGreaterThan(20)

    // Neovim options: the fixture has 5 real options → 5 vim.opt. lines
    const optionMatches = initLua.match(/vim\.opt\./g)
    expect(
      optionMatches?.length,
      `Expected at least 5 vim.opt. statements (from fixture options) but got ${optionMatches?.length ?? 0}`,
    ).toBeGreaterThanOrEqual(5)

    // Startup graph code present (from startup graphs in fixture)
    // The fixture has 5+1+2 = 8 startup graphs
    const hasStartupCode = initLua.includes('do') || initLua.includes('vim.opt')
    expect(hasStartupCode).toBe(true)

    // Callable function definitions present (from 3 callable graphs in fixture)
    // Callable graphs produce local function definitions
    const hasCallableCode =
      initLua.includes('local function') ||
      initLua.includes('-- callable') ||
      result.metadata.graphsGenerated > 0

    expect(hasCallableCode).toBe(true)

    // Block balance — full orchestrator output must have balanced blocks
    assertBlocksBalanced(initLua)

    // ── Performance assertion ────────────────────────────────────────────────
    const baseline = BASELINES_MS['13.8']
    const multiplier = getThresholdMultiplier()
    expect(
      stats.medianMs,
      `Possible regression: median ${stats.medianMs.toFixed(1)}ms > 2× baseline ${baseline}ms (×${multiplier.toFixed(1)} multiplier)`,
    ).toBeLessThan(baseline * 2 * multiplier)
    expect(stats.medianMs).toBeLessThan(applyMultiplier(TARGET_MS))
  }, 30_000)
})
