// ============================================
// Check 8: Duplicate Node IDs
// ============================================

import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

/**
 * Check ID constant for duplicate IDs.
 */
export const DUPLICATE_IDS_CHECK_ID = 'check-duplicate-ids'

/**
 * Find duplicate values in an array.
 * Returns a map of duplicate value -> array of indices where it appears.
 */
function findDuplicates<T extends string>(
  values: readonly T[],
): Map<T, number[]> {
  const seen = new Map<T, number[]>()
  const duplicates = new Map<T, number[]>()

  for (const [index, value] of values.entries()) {
    const existing = seen.get(value)
    if (existing) {
      existing.push(index)
      duplicates.set(value, existing)
    } else {
      seen.set(value, [index])
    }
  }

  return duplicates
}

/**
 * Check for duplicate IDs across all graphs.
 *
 * - Duplicate graph IDs across project → Error
 * - Duplicate node IDs within graph → Error
 * - Duplicate edge IDs within graph → Error
 *
 * Complexity: O(G * (N + E)) where G = graphs, N = nodes, E = edges
 */
export function checkDuplicateIds(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  // Check 1: Duplicate graph IDs across project
  const graphIds = ctx.graphs.map((g) => g.id)
  const duplicateGraphIds = findDuplicates(graphIds)

  for (const [graphId, indices] of duplicateGraphIds) {
    const affectedGraphs = indices
      .map((i) => ctx.graphs[i]?.name)
      .filter((name): name is string => name !== undefined)

    collector.addError({
      id: 'ERR_DUPLICATE_GRAPH_ID',
      category: 'structure',
      message: `Duplicate graph ID found: "${graphId}"`,
      details: `Multiple graphs share the same ID "${graphId}". Affected graphs: ${affectedGraphs.join(', ')}. This will cause undefined behavior during generation.`,
      source: {
        graphId,
      },
      suggestions: [
        'Rename one of the graphs to have a unique ID',
        'Delete the duplicate graph if it is not needed',
        'Re-import the project to regenerate unique IDs',
      ],
    })
  }

  // Check 2: Duplicate node IDs and edge IDs within each graph
  for (const graph of ctx.graphs) {
    // Check node IDs
    const nodeIds = graph.nodes.map((n) => n.id)
    const duplicateNodeIds = findDuplicates(nodeIds)

    for (const [nodeId, indices] of duplicateNodeIds) {
      const affectedNodes = indices
        .map((i) => {
          const node = graph.nodes[i]
          if (!node) return null
          const displayName =
            'displayName' in node.data
              ? (node.data.displayName as string | undefined)
              : undefined
          return displayName?.trim() || node.data.nodeType
        })
        .filter((name): name is string => name !== null)

      collector.addError({
        id: 'ERR_DUPLICATE_NODE_ID',
        category: 'structure',
        message: `Duplicate node ID found: "${nodeId}"`,
        details: `Multiple nodes in graph "${graph.name}" share the same ID "${nodeId}". Affected nodes: ${affectedNodes.join(', ')}.`,
        source: {
          graphId: graph.id,
          graphName: graph.name,
          nodeId,
        },
        suggestions: [
          'Delete and recreate one of the duplicate nodes',
          'Copy-paste the node to generate a new unique ID',
          'Re-import the graph to regenerate IDs',
        ],
      })
    }

    // Check edge IDs
    const edgeIds = graph.edges.map((e) => e.id)
    const duplicateEdgeIds = findDuplicates(edgeIds)

    for (const [edgeId] of duplicateEdgeIds) {
      collector.addError({
        id: 'ERR_DUPLICATE_EDGE_ID',
        category: 'structure',
        message: `Duplicate edge ID found: "${edgeId}"`,
        details: `Multiple edges in graph "${graph.name}" share the same ID "${edgeId}".`,
        source: {
          graphId: graph.id,
          graphName: graph.name,
        },
        suggestions: [
          'Delete and recreate one of the duplicate connections',
          'Re-import the graph to regenerate edge IDs',
        ],
      })
    }
  }
}
