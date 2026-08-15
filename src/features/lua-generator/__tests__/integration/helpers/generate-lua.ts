/**
 * Pipeline wrapper for integration tests.
 *
 * Provides a thin, dependency-free wrapper around `generateAllGraphs` and
 * `assembleFinalInitLua` so integration tests can produce complete Lua output
 * without needing mocked storage, Tauri IPC, or an orchestrator.
 */

import { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import { assembleFinalInitLua } from '@/features/lua-generator/orchestrator/assemble'
import { generateAllGraphs } from '@/features/lua-generator/orchestrator/graph-generation'
import type { CompilationUnit } from '@/features/lua-generator/types'
import type { Graph } from '@/shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneratedLuaResult {
  /** The fully assembled init.lua string */
  lua: string
  /** Diagnostics collector from the generation run */
  diagnostics: DiagnosticsCollector
  /** Callable compilation units (one per callable-entry per graph) */
  callableUnits: CompilationUnit[]
  /** Startup compilation units (one per trigger per graph) */
  startupUnits: CompilationUnit[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full generation pipeline on an array of graphs and return the
 * assembled Lua plus metadata useful for assertions.
 *
 * Does NOT touch the filesystem; suitable for Vitest (no Tauri required).
 */
export function generateLuaFromGraphs(graphs: Graph[]): GeneratedLuaResult {
  const diagnostics = new DiagnosticsCollector()

  const { callableUnits, startupUnits } = generateAllGraphs(graphs, diagnostics)

  // Convert compilation units to snippet arrays the assembler expects.
  // Each unit whose code is non-empty contributes one snippet block.
  const callableFunctionSnippets: string[][] = callableUnits
    .filter((u) => u.code.length > 0)
    .map((u) => u.code)

  const startupExecutionSnippets: string[][] = startupUnits
    .filter((u) => u.code.length > 0)
    .map((u) => u.code)

  const lua = assembleFinalInitLua(
    [], // no extra section results needed for connection-pattern tests
    callableFunctionSnippets,
    startupExecutionSnippets,
    {
      projectName: 'integration-test',
      generationDate: '2026-01-01',
    },
  )

  return { lua, diagnostics, callableUnits, startupUnits }
}

/**
 * Convenience wrapper for a single graph.
 */
export function generateLuaFromGraph(graph: Graph): GeneratedLuaResult {
  return generateLuaFromGraphs([graph])
}
