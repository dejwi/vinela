// ============================================
// Diagnostics Framework - Main Exports
// ============================================

export {
  checkCircularDependencies,
  checkCodeBlocks,
  checkDisabledDependencies,
  checkDisconnectedEntryPoints,
  checkDuplicateIds,
  checkEmptyGraphs,
  checkInvalidConfig,
  checkInvalidGraphRefs,
  checkMissingRequiredPorts,
  checkOrphanedNodes,
  checkTargetNeovimBaseline,
  checkTypeMismatches,
} from './checks'

export { DiagnosticsCollector } from './collector'
export type {
  DiagnosticCategory,
  DiagnosticSource,
  GenerationDiagnostic,
  GraphAdjacencyLists,
  PortConnectionState,
  PreGenerationCheck,
  PreGenerationContext,
} from './types'

// ============================================
// Pre-Generation Check Registry
// ============================================

import {
  checkCircularDependencies,
  checkCodeBlocks,
  checkDisabledDependencies,
  checkDisconnectedEntryPoints,
  checkDuplicateIds,
  checkEmptyGraphs,
  checkInvalidConfig,
  checkInvalidGraphRefs,
  checkMissingRequiredPorts,
  checkOrphanedNodes,
  checkTargetNeovimBaseline,
  checkTypeMismatches,
} from './checks'
import type { PreGenerationCheck } from './types'

/**
 * All pre-generation diagnostic checks in execution order.
 * Run structural checks first, then content checks.
 */
export const PRE_GENERATION_CHECKS: PreGenerationCheck[] = [
  // Structural integrity checks (run first)
  {
    id: 'check-duplicate-ids',
    run: checkDuplicateIds,
  },
  {
    id: 'check-empty-graphs',
    run: checkEmptyGraphs,
  },
  // Reference and connectivity checks
  {
    id: 'check-invalid-graph-refs',
    run: checkInvalidGraphRefs,
  },
  {
    id: 'check-disconnected-entry-points',
    run: checkDisconnectedEntryPoints,
  },
  {
    id: 'check-disabled-dependencies',
    run: checkDisabledDependencies,
  },
  // Cycle detection
  {
    id: 'check-circular-dependencies',
    run: checkCircularDependencies,
  },
  // Port and type checks
  {
    id: 'check-missing-required-ports',
    run: checkMissingRequiredPorts,
  },
  {
    id: 'check-type-mismatches',
    run: checkTypeMismatches,
  },
  // Structure and reachability
  {
    id: 'check-orphaned-nodes',
    run: checkOrphanedNodes,
  },
  // Configuration validation
  {
    id: 'check-invalid-config',
    run: checkInvalidConfig,
  },
  {
    id: 'check-code-blocks',
    run: checkCodeBlocks,
  },
  {
    id: 'check-target-neovim-baseline',
    run: checkTargetNeovimBaseline,
  },
]

// ============================================
// Context Builder
// ============================================

import { computeDisableStates } from '@/features/graph-editor/utils/graph-disable-state'
import type { TargetNeovimSnapshot } from '@/features/lua-generator/lib/target-neovim'
import type {
  Graph,
  GraphCallableContract,
  GraphNode,
  InstalledPlugin,
  ResolvedSchema,
} from '@/shared/types'
import { extractCallableContract } from '@/shared/types/graph'
import type { PreGenerationContext } from './types'

export const DEFAULT_TEST_TARGET_NEOVIM: TargetNeovimSnapshot = {
  kind: 'detected',
  version: '0.12.4',
  versionDisplay: 'NVIM v0.12.4',
}

export interface BuildContextOptions {
  graphs: readonly Graph[]
  installedPlugins?: readonly InstalledPlugin[] | undefined
  schemas?: readonly ResolvedSchema[] | undefined
  targetNeovim?: TargetNeovimSnapshot | undefined
}

/**
 * Build pre-generation context with all precomputed indices.
 * This should be called once per generation request.
 */
export function buildPreGenerationContext(
  options: BuildContextOptions,
): PreGenerationContext {
  const { graphs } = options

  // Build graph lookup
  const graphsById = new Map<string, Graph>()
  for (const graph of graphs) {
    graphsById.set(graph.id, graph)
  }

  // Build node and edge indices by graph
  const nodesByGraph = new Map<string, (typeof graphs)[number]['nodes']>()
  const edgesByGraph = new Map<string, (typeof graphs)[number]['edges']>()
  for (const graph of graphs) {
    nodesByGraph.set(graph.id, graph.nodes)
    edgesByGraph.set(graph.id, graph.edges)
  }

  // Compute disable states
  const { statesByGraphId: disableStates } = computeDisableStates(graphs)

  // Build callable contracts map
  const callableContracts = new Map<string, GraphCallableContract>()
  for (const graph of graphs) {
    const contract = extractCallableContract(graph)
    if (contract !== null) {
      callableContracts.set(graph.id, contract)
    }
  }

  return {
    graphs,
    graphsById,
    nodesByGraph,
    edgesByGraph,
    disableStates,
    callableContracts,
    installedPlugins: options.installedPlugins ?? [],
    schemas: options.schemas ?? [],
    targetNeovim: options.targetNeovim ?? DEFAULT_TEST_TARGET_NEOVIM,
  }
}

// ============================================
// Utilities
// ============================================

/**
 * Filter to only effectively enabled graphs.
 */
export function getEnabledGraphs(ctx: PreGenerationContext): Graph[] {
  return ctx.graphs.filter((graph) => {
    const state = ctx.disableStates.get(graph.id)
    return state?.effective.kind === 'enabled'
  })
}

/**
 * Get display name for a node (displayName or type-based fallback).
 */
export function getNodeDisplayName(
  node: GraphNode,
  fallbackLabel: string,
): string {
  const displayName =
    'displayName' in node.data
      ? (node.data.displayName as string | undefined)
      : undefined
  const normalized = displayName?.trim() ?? ''
  return normalized.length > 0 ? normalized : fallbackLabel
}

// ============================================
// Convenience Function: Run All Checks
// ============================================

import { DiagnosticsCollector } from './collector'

export interface RunAllChecksResult {
  collector: DiagnosticsCollector
  hasErrors: boolean
  hasWarnings: boolean
}

/**
 * Run all pre-generation checks and return collected diagnostics.
 *
 * This is a convenience function for the orchestrator to use.
 * It builds the context once and runs all checks in order.
 */
export function runAllPreGenerationChecks(
  ctx: PreGenerationContext,
): RunAllChecksResult {
  const collector = new DiagnosticsCollector()

  for (const check of PRE_GENERATION_CHECKS) {
    check.run(ctx, collector)
  }

  return {
    collector,
    hasErrors: collector.hasErrors(),
    hasWarnings: collector.hasWarnings(),
  }
}
