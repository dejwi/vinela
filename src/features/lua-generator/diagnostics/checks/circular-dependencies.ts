// ============================================
// Check 6: Circular Dependencies
// ============================================

import type { Graph, GraphEdge, GraphNode } from '@/shared/types'
import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

/**
 * Check ID constant for circular dependencies.
 */
export const CIRCULAR_DEPENDENCIES_CHECK_ID = 'check-circular-dependencies'

type NodeColor = 'white' | 'gray' | 'black'

// Cycle detection state tracking

/**
 * Build inter-graph adjacency list from graph-ref edges.
 * Maps: graphId -> Set of graphIds it references
 */
function buildInterGraphAdjacency(
  ctx: PreGenerationContext,
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()

  // Initialize all graphs
  for (const graph of ctx.graphs) {
    adj.set(graph.id, new Set())
  }

  // Build edges from graph-ref nodes
  for (const graph of ctx.graphs) {
    const targets = adj.get(graph.id)
    if (!targets) continue

    for (const node of graph.nodes) {
      if (node.data.nodeType === 'graph-ref') {
        const targetId = node.data.referencedGraphId
        if (targetId.length > 0) {
          targets.add(targetId)
        }
      }
    }
  }

  return adj
}

/**
 * Detect cycles in a directed graph using DFS coloring.
 * Returns the first cycle found, or null if no cycles.
 */
function detectCycleDFS(
  adj: ReadonlyMap<string, Set<string>>,
  startNode: string,
  colors: Map<string, NodeColor>,
  parentChain: Map<string, string | null>,
): string[] | null {
  colors.set(startNode, 'gray')

  const neighbors = adj.get(startNode)
  if (!neighbors) {
    colors.set(startNode, 'black')
    return null
  }

  for (const neighbor of neighbors) {
    const neighborColor = colors.get(neighbor)

    if (neighborColor === 'gray') {
      // Found a cycle - reconstruct path
      const cycle: string[] = [neighbor]
      let current: string | null = startNode
      while (current !== null && current !== neighbor) {
        cycle.push(current)
        current = parentChain.get(current) ?? null
      }
      cycle.push(neighbor) // Close the cycle
      cycle.reverse()
      return cycle
    }

    if (neighborColor === 'white') {
      parentChain.set(neighbor, startNode)
      const cycle = detectCycleDFS(adj, neighbor, colors, parentChain)
      if (cycle) {
        return cycle
      }
    }
  }

  colors.set(startNode, 'black')
  return null
}

/**
 * Find all cycles in inter-graph dependencies.
 */
function findInterGraphCycles(ctx: PreGenerationContext): string[][] {
  const adj = buildInterGraphAdjacency(ctx)
  const cycles: string[][] = []
  const colors = new Map<string, NodeColor>()
  const parentChain = new Map<string, string | null>()

  // Initialize colors
  for (const graphId of adj.keys()) {
    colors.set(graphId, 'white')
  }

  // Run DFS from each unvisited node
  for (const graphId of adj.keys()) {
    if (colors.get(graphId) === 'white') {
      parentChain.set(graphId, null)
      const cycle = detectCycleDFS(adj, graphId, colors, parentChain)
      if (cycle) {
        cycles.push(cycle)

        // Mark cycle nodes as black to avoid reporting same cycle multiple times
        for (const nodeId of cycle) {
          colors.set(nodeId, 'black')
        }
      }
    }
  }

  return cycles
}

/**
 * Build intra-graph adjacency for data and exec edges.
 */
function buildIntraGraphAdjacency(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()

  // Initialize all nodes
  for (const node of nodes) {
    adj.set(node.id, new Set())
  }

  // Add edges
  for (const edge of edges) {
    const targets = adj.get(edge.source)
    if (targets) {
      targets.add(edge.target)
    }
  }

  return adj
}

/**
 * Find cycles within a single graph's edge structure.
 */
function findIntraGraphCycles(graph: Graph): string[][] {
  const adj = buildIntraGraphAdjacency(graph.nodes, graph.edges)
  const cycles: string[][] = []
  const colors = new Map<string, NodeColor>()
  const parentChain = new Map<string, string | null>()

  // Initialize colors
  for (const nodeId of adj.keys()) {
    colors.set(nodeId, 'white')
  }

  // Run DFS from each unvisited node
  for (const nodeId of adj.keys()) {
    if (colors.get(nodeId) === 'white') {
      parentChain.set(nodeId, null)
      const cycle = detectCycleDFS(adj, nodeId, colors, parentChain)
      if (cycle) {
        cycles.push(cycle)

        // Mark cycle nodes as black
        for (const id of cycle) {
          colors.set(id, 'black')
        }
      }
    }
  }

  return cycles
}

/**
 * Get node names for a cycle path.
 */
function getCycleNodeNames(graph: Graph, cycle: string[]): string {
  const nodeMap = new Map<string, GraphNode>()
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node)
  }

  const names = cycle.map((nodeId) => {
    const node = nodeMap.get(nodeId)
    if (!node) return nodeId.slice(0, 8)

    const displayName =
      'displayName' in node.data
        ? (node.data.displayName as string | undefined)
        : undefined
    const name = displayName?.trim() || node.data.nodeType
    return `${name} (${nodeId.slice(0, 6)})`
  })

  return names.join(' → ')
}

/**
 * Get graph names for an inter-graph cycle.
 */
function getCycleGraphNames(
  ctx: PreGenerationContext,
  cycle: string[],
): string {
  const names = cycle.map((graphId) => {
    const graph = ctx.graphsById.get(graphId)
    return graph?.name || graphId.slice(0, 8)
  })

  return names.join(' → ')
}

/**
 * Check for circular dependencies.
 *
 * - Detects cycles in data edges (within graphs)
 * - Detects cycles in exec edges (shouldn't happen but check)
 * - Detects inter-graph cycles via graph-ref dependencies
 * - Reports full cycle path: A → B → C → A
 *
 * Complexity: O(G * (V + E)) where G = graphs, V/E = nodes/edges per graph
 */
export function checkCircularDependencies(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  // Check 1: Inter-graph cycles (graph-ref dependencies)
  const interGraphCycles = findInterGraphCycles(ctx)

  for (const cycle of interGraphCycles) {
    if (cycle.length === 0) continue

    const cycleDisplay = getCycleGraphNames(ctx, cycle)
    const firstGraphId = cycle[0]
    if (firstGraphId === undefined) continue

    const firstGraph = ctx.graphsById.get(firstGraphId)

    collector.addError({
      id: 'ERR_CYCLE_INTER_GRAPH',
      category: 'cycle',
      message: `Circular dependency detected between graphs`,
      details: `Graphs form a circular call chain: ${cycleDisplay}. This would cause infinite recursion at runtime.`,
      source: {
        graphId: firstGraphId,
        ...(firstGraph !== undefined ? { graphName: firstGraph.name } : {}),
      },
      suggestions: [
        'Break the cycle by removing one of the graph references',
        'Merge the graphs to eliminate the circular dependency',
        'Use events or callbacks instead of direct graph references',
      ],
    })
  }

  // Check 2: Intra-graph cycles (within each graph)
  for (const graph of ctx.graphs) {
    // Skip disabled graphs
    const disableState = ctx.disableStates.get(graph.id)
    if (disableState?.effective.kind !== 'enabled') {
      continue
    }

    if (graph.nodes.length === 0 || graph.edges.length === 0) {
      continue
    }

    const intraGraphCycles = findIntraGraphCycles(graph)

    for (const cycle of intraGraphCycles) {
      if (cycle.length === 0) continue

      const cycleDisplay = getCycleNodeNames(graph, cycle)

      collector.addError({
        id: 'ERR_CYCLE_INTRA_GRAPH',
        category: 'cycle',
        message: `Circular node dependency in graph "${graph.name}"`,
        details: `Nodes form a circular dependency chain: ${cycleDisplay}. Data cannot flow in a cycle.`,
        source: {
          graphId: graph.id,
          graphName: graph.name,
          ...(cycle[0] ? { nodeId: cycle[0] } : {}),
        },
        suggestions: [
          'Break the cycle by removing one of the connections',
          'Reorganize the graph to use a different flow pattern',
          'Consider using a loop node for iterative operations',
        ],
      })
    }
  }
}
