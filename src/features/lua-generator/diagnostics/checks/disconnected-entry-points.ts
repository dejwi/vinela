// ============================================
// Check 3: Disconnected Entry Points
// ============================================

import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

/**
 * Check ID constant for disconnected entry points.
 */
export const DISCONNECTED_ENTRY_POINTS_CHECK_ID =
  'check-disconnected-entry-points'

/**
 * Count incoming graph references for callable graphs.
 *
 * This builds a map of graphId -> count of graph-ref nodes targeting it.
 */
function buildIncomingReferenceCounts(
  ctx: PreGenerationContext,
): Map<string, number> {
  const counts = new Map<string, number>()

  // Initialize all callable graphs with 0
  for (const [graphId] of ctx.callableContracts) {
    counts.set(graphId, 0)
  }

  // Count references from graph-ref nodes
  for (const graph of ctx.graphs) {
    for (const node of graph.nodes) {
      if (node.data.nodeType === 'graph-ref') {
        const targetId = node.data.referencedGraphId
        if (targetId.length > 0 && counts.has(targetId)) {
          const current = counts.get(targetId) ?? 0
          counts.set(targetId, current + 1)
        }
      }
    }
  }

  return counts
}

/**
 * Check for disconnected entry points across all graphs.
 *
 * A callable graph (one with a callable-entry node) that is never
 * referenced by any graph-ref node is considered disconnected.
 *
 * This is a warning-level diagnostic since the graph may be:
 * 1. Intended for future use
 * 2. Called dynamically via other mechanisms
 * 3. A library-style graph meant to be called manually
 *
 * Complexity: O(G * N) where G = graphs, N = nodes
 */
export function checkDisconnectedEntryPoints(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  // Build reference counts for callable graphs
  const referenceCounts = buildIncomingReferenceCounts(ctx)

  // Check each callable graph
  for (const [graphId, count] of referenceCounts) {
    if (count > 0) {
      continue // Graph is referenced, no warning needed
    }

    const graph = ctx.graphsById.get(graphId)
    if (graph === undefined) {
      continue // Graph not found, shouldn't happen
    }

    // Skip disabled graphs
    const disableState = ctx.disableStates.get(graphId)
    if (disableState?.effective.kind !== 'enabled') {
      continue
    }

    collector.addWarning({
      id: 'WARN_STRUCTURE_DISCONNECTED_CALLABLE',
      category: 'structure',
      message: `Graph "${graph.name}" is callable but never called`,
      details: `This graph has a Callable Entry node but is not referenced by any Graph Reference nodes. It will not be executed unless called dynamically.`,
      source: {
        graphId: graph.id,
        graphName: graph.name,
      },
      suggestions: [
        'Add a Graph Reference node in another graph to call this one',
        'Remove the Callable Entry node if this graph should not be callable',
        'Add a Trigger node if this graph should run on startup',
      ],
    })
  }
}
