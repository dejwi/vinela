// ============================================
// Check 5: Invalid Graph References
// ============================================

import type { GraphNode } from '@/shared/types'
import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

/**
 * Check ID constant for invalid graph references.
 */
export const INVALID_GRAPH_REFS_CHECK_ID = 'check-invalid-graph-refs'

/**
 * Get display name for a node.
 */
function getNodeDisplayName(node: GraphNode): string {
  const displayName =
    'displayName' in node.data
      ? (node.data.displayName as string | undefined)
      : undefined
  return displayName?.trim() || node.id.slice(0, 8)
}

/**
 * Check for invalid graph references.
 *
 * - GraphRef nodes pointing to non-existent graphs → Error
 * - GraphRef pointing to non-callable graphs → Error
 * - GraphRef to disabled graph → Warning
 *
 * Complexity: O(G * N) where G = graphs, N = nodes
 */
export function checkInvalidGraphRefs(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  for (const graph of ctx.graphs) {
    // Skip disabled graphs - their refs don't matter
    const graphDisableState = ctx.disableStates.get(graph.id)
    if (graphDisableState?.effective.kind !== 'enabled') {
      continue
    }

    for (const node of graph.nodes) {
      if (node.data.nodeType !== 'graph-ref') {
        continue
      }

      const refData = node.data
      const referencedGraphId = refData.referencedGraphId
      const nodeName = getNodeDisplayName(node)

      // Check 1: Empty or missing referencedGraphId
      if (referencedGraphId.length === 0) {
        collector.addError({
          id: 'ERR_REF_GRAPH_REF_NO_TARGET',
          category: 'reference',
          message: `Graph Reference "${nodeName}" has no target graph selected`,
          details:
            'The Graph Reference node must reference a callable graph. No target graph is currently selected.',
          source: {
            graphId: graph.id,
            graphName: graph.name,
            nodeId: node.id,
            nodeType: 'graph-ref',
          },
          suggestions: [
            'Select a callable graph from the dropdown',
            'Create a new callable graph and reference it',
          ],
        })
        continue
      }

      // Check 2: Target graph doesn't exist
      const targetGraph = ctx.graphsById.get(referencedGraphId)
      if (targetGraph === undefined) {
        collector.addError({
          id: 'ERR_REF_GRAPH_REF_MISSING_TARGET',
          category: 'reference',
          message: `Graph Reference "${nodeName}" points to missing graph "${referencedGraphId}"`,
          details: `The referenced graph "${referencedGraphId}" does not exist in this project. It may have been deleted or the reference may be stale.`,
          source: {
            graphId: graph.id,
            graphName: graph.name,
            nodeId: node.id,
            nodeType: 'graph-ref',
          },
          suggestions: [
            'Select a different callable graph',
            `Create a graph with ID "${referencedGraphId}" and add a Callable Entry node`,
            'Remove this Graph Reference node if it is no longer needed',
          ],
        })
        continue
      }

      // Check 3: Target graph exists but is not callable (no callable-entry)
      const targetContract = ctx.callableContracts.get(referencedGraphId)
      if (targetContract === undefined) {
        collector.addError({
          id: 'ERR_REF_GRAPH_REF_NOT_CALLABLE',
          category: 'reference',
          message: `Graph Reference "${nodeName}" points to non-callable graph "${targetGraph.name}"`,
          details: `The graph "${targetGraph.name}" does not have a Callable Entry node. Only graphs with Callable Entry nodes can be referenced.`,
          source: {
            graphId: graph.id,
            graphName: graph.name,
            nodeId: node.id,
            nodeType: 'graph-ref',
          },
          suggestions: [
            `Add a Callable Entry node to "${targetGraph.name}"`,
            'Select a different callable graph',
            'Remove this Graph Reference node',
          ],
        })
      }
    }
  }
}
