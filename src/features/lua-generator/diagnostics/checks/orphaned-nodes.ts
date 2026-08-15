// ============================================
// Check 1: Orphaned Nodes
// ============================================

import type { GraphNode } from '@/shared/types'
import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

/**
 * Check ID constant for orphaned nodes.
 */
export const ORPHANED_NODES_CHECK_ID = 'check-orphaned-nodes'

/**
 * Find entry nodes in a graph (trigger and callable-entry).
 */
function findEntryNodes(nodes: readonly GraphNode[]): GraphNode[] {
  return nodes.filter(
    (node) =>
      node.data.nodeType === 'trigger' ||
      node.data.nodeType === 'callable-entry',
  )
}

/**
 * Build adjacency list for exec flow (void data type connections).
 */
function buildExecAdjacency(
  nodes: readonly GraphNode[],
  edges: readonly { source: string; target: string; sourcePort: string }[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>()

  // Initialize all nodes
  for (const node of nodes) {
    adj.set(node.id, [])
  }

  // Add edges (exec flow only - for now treat all edges as exec)
  // In a full implementation, we'd check port data types
  for (const edge of edges) {
    const downstream = adj.get(edge.source)
    if (downstream !== undefined) {
      downstream.push(edge.target)
    }
  }

  return adj
}

/**
 * Traverse reachable nodes from entry points using BFS.
 * Returns set of reachable node IDs.
 *
 * Complexity: O(V + E)
 */
function findReachableNodes(
  entryNodes: readonly GraphNode[],
  execAdj: ReadonlyMap<string, string[]>,
): Set<string> {
  const reachable = new Set<string>()
  const queue: string[] = []

  // Start from all entry nodes
  for (const entry of entryNodes) {
    if (!reachable.has(entry.id)) {
      reachable.add(entry.id)
      queue.push(entry.id)
    }
  }

  // BFS traversal
  let head = 0
  while (head < queue.length) {
    const currentId = queue[head]
    head += 1
    if (currentId === undefined) continue

    const downstream = execAdj.get(currentId) ?? []
    for (const nextId of downstream) {
      if (!reachable.has(nextId)) {
        reachable.add(nextId)
        queue.push(nextId)
      }
    }
  }

  return reachable
}

/**
 * Check for orphaned nodes in effectively enabled graphs.
 *
 * A node is orphaned if:
 * 1. It's not an entry node (trigger or callable-entry)
 * 2. It's not reachable from any entry node via exec flow
 * 3. It's not a data provider for any reachable node
 *
 * Complexity: O(G * (V + E)) where G = number of graphs
 */
export function checkOrphanedNodes(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  for (const graph of ctx.graphs) {
    // Skip disabled graphs
    const disableState = ctx.disableStates.get(graph.id)
    if (disableState?.effective.kind !== 'enabled') {
      continue
    }

    const nodes = graph.nodes
    if (nodes.length === 0) {
      continue
    }

    const edges = graph.edges
    const entryNodes = findEntryNodes(nodes)

    // Build exec adjacency
    const execAdj = buildExecAdjacency(nodes, edges)

    // Find all nodes reachable from entry points
    const reachableFromEntries = findReachableNodes(entryNodes, execAdj)

    // Also find data providers that feed into reachable nodes
    // For now, simple approach: nodes that are sources of edges to reachable nodes
    const dataProviders = new Set<string>()
    for (const edge of edges) {
      if (reachableFromEntries.has(edge.target)) {
        dataProviders.add(edge.source)
      }
    }

    // Mark data providers and their reachable subgraphs
    const dataProviderReachable = findReachableNodes(
      nodes.filter((n) => dataProviders.has(n.id)),
      execAdj,
    )

    // Combine all reachable nodes
    const allReachable = new Set<string>([
      ...reachableFromEntries,
      ...dataProviderReachable,
    ])

    // Check each non-entry node
    for (const node of nodes) {
      // Entry nodes are never orphaned
      if (
        node.data.nodeType === 'trigger' ||
        node.data.nodeType === 'callable-entry'
      ) {
        continue
      }

      // Skip if reachable
      if (allReachable.has(node.id)) {
        continue
      }

      // Get display name
      const displayName =
        'displayName' in node.data
          ? (node.data.displayName as string | undefined)
          : undefined
      const nameOrId = displayName?.trim() || node.id.slice(0, 8)

      collector.addWarning({
        id: 'WARN_STRUCTURE_ORPHANED_NODE',
        category: 'structure',
        message: `Node "${nameOrId}" is never executed`,
        details: `The ${node.data.nodeType} node is not connected to any entry point via exec flow.`,
        source: {
          graphId: graph.id,
          graphName: graph.name,
          nodeId: node.id,
          nodeType: node.data.nodeType,
        },
        suggestions: [
          'Add an exec connection from an entry point or callable node',
          'Remove the node if it is no longer needed',
        ],
      })
    }
  }
}
