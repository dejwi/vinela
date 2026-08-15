// ============================================
// Domain 2: Graph Indexing
// Build optimized indexes for O(V+E) traversal
// ============================================

import type { Graph, GraphNode } from '@/shared/types'
import { indexSingleGraph } from './index-single-graph'
import type {
  DataEdge,
  ExecEdge,
  IndexedGraph,
  TraversalGraphIndexes,
} from './types'

/**
 * Build comprehensive indexes for a collection of graphs.
 * This is O(V+E) across all graphs.
 */
export function buildGraphIndexes(
  graphs: readonly Graph[],
): TraversalGraphIndexes {
  const byGraph = new Map<string, IndexedGraph>()
  const allNodes = new Map<string, GraphNode>()

  for (const graph of graphs) {
    const indexed = indexSingleGraph(graph)
    byGraph.set(graph.id, indexed)

    for (const node of graph.nodes) {
      allNodes.set(node.id, node)
    }
  }

  return {
    byGraph,
    allNodes,
  }
}

/**
 * Get a specific node's outgoing exec edges deterministically sorted.
 */
export function getOutgoingExecEdges(
  indexes: IndexedGraph,
  nodeId: string,
): readonly ExecEdge[] {
  const edges = indexes.outgoingExecByNode.get(nodeId)
  if (!edges) return []
  return [...edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId))
}

/**
 * Get a specific node's incoming data edges for a specific port.
 */
export function getIncomingDataEdges(
  indexes: IndexedGraph,
  nodeId: string,
  portId: string,
): readonly DataEdge[] {
  const targetPortMap = indexes.incomingDataByTargetPort.get(nodeId)
  if (!targetPortMap) return []
  const edges = targetPortMap.get(portId)
  return edges
    ? [...edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId))
    : []
}

/**
 * Get all incoming data edges for a node.
 */
export function getAllIncomingDataEdges(
  indexes: IndexedGraph,
  nodeId: string,
): readonly DataEdge[] {
  const edges = indexes.incomingDataByNode.get(nodeId)
  if (!edges) return []
  return [...edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId))
}
