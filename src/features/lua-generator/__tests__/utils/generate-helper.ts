/**
 * Generate Helper Utility
 *
 * Single-call helper for integration tests: runs real graph generation and
 * assembles the final init.lua, returning Lua + diagnostics + generated units
 * for assertions. Eliminates per-test mock setup of storage/orchestrator deps.
 */

import { assembleFinalInitLua } from '@/features/lua-generator/orchestrator/assemble'
import { generateAllGraphs } from '@/features/lua-generator/orchestrator/graph-generation'
import type {
  CompilationUnit,
  SectionResult,
} from '@/features/lua-generator/types'
import type { Graph, GraphCallableContract } from '@/shared/types'
import { DiagnosticsCollector } from '../../diagnostics/collector'

// ============================================
// Public Types
// ============================================

export interface GenerateLuaFromGraphsOptions {
  /** Deterministic project name embedded in the header comment (default: 'Test Project') */
  projectName?: string
  /** Deterministic ISO timestamp for the header comment (default: '1970-01-01T00:00:00.000Z') */
  generationDate?: string
  /**
   * Additional pre-generated section results to include in assembly.
   * Defaults to an empty array — integration tests that need section output
   * should pass explicit section fixtures here.
   */
  sections?: SectionResult[]
  /**
   * Node type used to select callable snippet blocks from compilation units.
   * Defaults to 'callable-entry' (matches how the phase coordinator works).
   */
  preferredCallableNodeType?: string
  /**
   * Node type used to select startup snippet blocks from compilation units.
   * Defaults to 'trigger' (matches how the phase coordinator works).
   */
  preferredStartupNodeType?: string
}

export interface GenerateLuaFromGraphsResult {
  /** The assembled final Lua string */
  lua: string
  /** Diagnostics collector populated during generation (inspect for warnings/errors) */
  diagnostics: DiagnosticsCollector
  /** All compilation units produced from callable-entry graphs */
  callableUnits: CompilationUnit[]
  /** All compilation units produced from startup trigger graphs */
  startupUnits: CompilationUnit[]
  /** Callable contracts indexed by graph ID */
  callableContracts: Map<string, GraphCallableContract>
}

// ============================================
// Public API
// ============================================

/**
 * Run full graph generation + assembly in a single call.
 *
 * Determinism defaults (important for snapshot tests):
 * - `projectName = 'Test Project'`
 * - `generationDate = '1970-01-01T00:00:00.000Z'`
 * - `sections = []`
 *
 * Edge cases handled transparently by the underlying generators:
 * - Empty graph array → valid header-only Lua
 * - Only callable graphs → startup snippets empty
 * - Only startup graphs → callable snippets empty
 * - Disabled graphs → filtered by `graph.enabled` flag in `generateAllGraphs`
 * - Graph order → preserved from input array
 *
 * Errors from generation or assembly are NOT swallowed — tests fail with a
 * stack trace. Non-fatal issues surface through the returned `diagnostics`.
 */
export function generateLuaFromGraphs(
  graphs: readonly Graph[],
  options?: GenerateLuaFromGraphsOptions,
): GenerateLuaFromGraphsResult {
  const projectName = options?.projectName ?? 'Test Project'
  const generationDate = options?.generationDate ?? '1970-01-01T00:00:00.000Z'
  const sections = options?.sections ?? []
  const preferredCallableNodeType =
    options?.preferredCallableNodeType ?? 'callable-entry'
  const preferredStartupNodeType =
    options?.preferredStartupNodeType ?? 'trigger'

  const diagnostics = new DiagnosticsCollector()

  // Phase 6: Graph generation
  const { callableUnits, startupUnits, callableContracts } = generateAllGraphs(
    [...graphs],
    diagnostics,
  )

  // Build snippet block arrays for assembly (mirrors phase-coordinator logic)
  const callableFunctionSnippets = buildSnippetBlocks(
    callableUnits,
    preferredCallableNodeType,
  )
  const startupExecutionSnippets = buildSnippetBlocks(
    startupUnits,
    preferredStartupNodeType,
  )

  // Phase 7: Assembly
  const lua = assembleFinalInitLua(
    sections,
    callableFunctionSnippets,
    startupExecutionSnippets,
    { projectName, generationDate },
  )

  return {
    lua,
    diagnostics,
    callableUnits,
    startupUnits,
    callableContracts,
  }
}

/**
 * Generate Lua and return only the joined startup execution code.
 *
 * Useful for unit-level assertions when you only care about what a
 * particular graph's startup code looks like, without the assembly wrapper.
 *
 * @param graphs - The graphs to generate from
 * @returns Joined Lua string from all startup units
 */
export function generateStartupCode(graphs: readonly Graph[]): string {
  const collector = new DiagnosticsCollector()
  const result = generateAllGraphs([...graphs], collector)
  return result.startupUnits.map((u) => u.code.join('\n')).join('\n')
}

// ============================================
// Private Helpers
// ============================================

/**
 * Mirrors `buildSnippetBlocks` from phase-coordinator.
 *
 * Selects units of the preferred node type and returns their code arrays.
 * Falls back to all non-empty units when no preferred-type units exist.
 */
function buildSnippetBlocks(
  units: readonly CompilationUnit[],
  preferredNodeType: string,
): string[][] {
  const preferredUnits = units.filter(
    (unit) => unit.nodeType === preferredNodeType && unit.code.length > 0,
  )

  if (preferredUnits.length > 0) {
    return preferredUnits.map((unit) => [...unit.code])
  }

  return units
    .filter((unit) => unit.code.length > 0)
    .map((unit) => [...unit.code])
}
