/**
 * Single Node Test Helpers
 *
 * Shared utilities for Category 1 single-node integration tests.
 * Provides graph building helpers, generation wrapper, Lua syntax validation,
 * and output assertion utilities.
 */

import { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import type { GenerationDiagnostic } from '@/features/lua-generator/diagnostics/types'
import { generateAllGraphs } from '@/features/lua-generator/orchestrator/graph-generation'
import type { CompilationUnit } from '@/features/lua-generator/types'
import type { ActionNodeData, Graph, RunFunctionNodeData } from '@/shared/types'
import type { CallFunctionActionConfig } from '../../generators/nodes/action/call-function'
import { GraphBuilder } from '../utils/graph-builder'
import { assertLuaSyntaxValid } from '../utils/lua-assert'

export { assertLuaSyntaxValid }

// ─────────────────────────────────────────────────────────────────────────────
// Result type
// ─────────────────────────────────────────────────────────────────────────────

export interface SingleGraphGenerationResult {
  /** All compilation units for startup trigger path */
  startupUnits: CompilationUnit[]
  /** All compilation units for callable entry path */
  callableUnits: CompilationUnit[]
  /** Diagnostics collector (accessible for warning/error assertions) */
  collector: DiagnosticsCollector
  /** All startup unit code joined with newlines */
  startupLua: string
  /** All callable + startup unit code joined with newlines */
  allLua: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Core generation wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run generateAllGraphs with a fresh DiagnosticsCollector.
 * Returns unified result object for assertions.
 */
export function generateSingleGraph(graph: Graph): SingleGraphGenerationResult {
  const collector = new DiagnosticsCollector()
  const result = generateAllGraphs([graph], collector)

  const startupLua = result.startupUnits
    .map((u) => u.code.join('\n'))
    .join('\n')
  const callableLua = result.callableUnits
    .map((u) => u.code.join('\n'))
    .join('\n')
  const allLua = [callableLua, startupLua].filter(Boolean).join('\n')

  return {
    startupUnits: result.startupUnits,
    callableUnits: result.callableUnits,
    collector,
    startupLua,
    allLua,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph skeleton helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a startup graph with a deterministic skeleton.
 * Passes a GraphBuilder pre-seeded with a startup trigger node (`entry`) to
 * the callback. Returns the built Graph.
 */
export function buildStartupGraph(
  build: (b: GraphBuilder) => GraphBuilder,
  name = 'test-graph',
): Graph {
  const builder = new GraphBuilder(name).startupTrigger('entry')
  return build(builder).build()
}

// ─────────────────────────────────────────────────────────────────────────────
// Order / containment assertions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert that `snippets` all appear in `lua` in the given order.
 * Uses indexOf to verify relative ordering.
 */
export function expectLuaContainsInOrder(
  lua: string,
  snippets: string[],
): void {
  let searchFrom = 0
  for (const snippet of snippets) {
    const idx = lua.indexOf(snippet, searchFrom)
    if (idx === -1) {
      throw new Error(
        `Expected Lua to contain "${snippet}" after position ${searchFrom}.\n\n--- Lua ---\n${lua}`,
      )
    }
    searchFrom = idx + snippet.length
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compilation unit helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find a compilation unit by node ID from a unit list.
 */
export function findUnit(
  units: CompilationUnit[],
  nodeId: string,
): CompilationUnit | undefined {
  return units.find((u) => u.nodeId === nodeId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic assertion helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert no errors in collector.
 */
export function assertNoErrors(collector: DiagnosticsCollector): void {
  const errors = collector.getErrors()
  if (errors.length > 0) {
    const msgs = errors.map((e) => `  [${e.id}] ${e.message}`).join('\n')
    throw new Error(`Expected no errors, but got:\n${msgs}`)
  }
}

/**
 * Assert a specific warning ID is present.
 * Supports both exact match and prefix match (since createNodeDiagnostic
 * appends the nodeId to form IDs like "node-unsupported-legacy-node1").
 */
export function assertHasWarning(
  collector: DiagnosticsCollector,
  warningId: string,
): void {
  const warnings = collector.getWarnings()
  const found = warnings.some(
    (w) => w.id === warningId || w.id.startsWith(`${warningId}-`),
  )
  if (!found) {
    const ids = warnings.map((w) => w.id).join(', ') || '(none)'
    throw new Error(`Expected warning "${warningId}" but got: ${ids}`)
  }
}

/**
 * Assert no diagnostics at all.
 */
export function assertNoDiagnostics(collector: DiagnosticsCollector): void {
  const all = collector.getAll()
  if (all.length > 0) {
    const msgs = (all as GenerationDiagnostic[])
      .map((d) => `  [${d.severity}:${d.id}] ${d.message}`)
      .join('\n')
    throw new Error(`Expected no diagnostics, but got:\n${msgs}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Patch helpers for DSL gaps
// ─────────────────────────────────────────────────────────────────────────────

import type { RunFunctionSignatureSnapshot } from '@/shared/types/run-function'

/**
 * Patch a run-function node with a real signature and optional param defaults.
 * GraphBuilder initialises `signature: null` — tests must call this to provide
 * a valid signature before generating.
 *
 * Mutates the graph in place (tests work with freshly built graphs).
 */
export function patchRunFunctionSignature(
  graph: Graph,
  nodeId: string,
  signature: RunFunctionSignatureSnapshot,
  paramDefaults: RunFunctionNodeData['paramDefaults'] = {},
): void {
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (node === undefined) {
    throw new Error(
      `patchRunFunctionSignature: node "${nodeId}" not found in graph`,
    )
  }
  if (node.data.nodeType !== 'run-function') {
    throw new Error(
      `patchRunFunctionSignature: node "${nodeId}" is not a run-function node`,
    )
  }
  // Mutation is intentional here — the graph is freshly built for each test
  ;(node.data as RunFunctionNodeData).signature = signature
  ;(node.data as RunFunctionNodeData).paramDefaults = paramDefaults
}

/**
 * Patch an action node to use call-function actionConfig.
 * GraphBuilder's action() method cannot construct call-function directly
 * because it's not a CoreActionType. This helper rewrites the config.
 *
 * Mutates the graph in place.
 */
export function patchActionAsCallFunction(
  graph: Graph,
  nodeId: string,
  config: CallFunctionActionConfig,
): void {
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (node === undefined) {
    throw new Error(
      `patchActionAsCallFunction: node "${nodeId}" not found in graph`,
    )
  }
  if (node.data.nodeType !== 'action') {
    throw new Error(
      `patchActionAsCallFunction: node "${nodeId}" is not an action node`,
    )
  }
  // Overwrite actionConfig and actionType so the dispatcher routes to action:call-function
  ;(node.data as ActionNodeData).actionConfig =
    config as unknown as ActionNodeData['actionConfig']
  // 'call-function' is not in CoreActionType but register.ts registers 'action:call-function'
  // resolveGeneratorType returns `action:${actionType}` so we must set the type here
  ;(node.data as ActionNodeData).actionType =
    'call-function' as ActionNodeData['actionType']
}
