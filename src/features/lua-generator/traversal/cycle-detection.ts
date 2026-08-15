// ============================================
// Domain 2: Cycle Detection
// Detect cycles in exec and data flow graphs
// ============================================

import type { CycleDetectionResult, IndexedGraph } from './types'

/**
 * Detect all cycles in the execution flow of a graph.
 * Uses DFS-based cycle detection.
 *
 * Time complexity: O(V+E)
 * Space complexity: O(V)
 *
 * @param indexed - The indexed graph
 * @returns Cycle detection result with all cycles found
 */
export function detectExecCycles(indexed: IndexedGraph): CycleDetectionResult {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(nodeId: string): void {
    if (recursionStack.has(nodeId)) {
      // Found a cycle - extract it from the path
      const cycleStart = path.indexOf(nodeId)
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart)
        cycle.push(nodeId) // Close the cycle
        cycles.push(cycle)
      }
      return
    }

    if (visited.has(nodeId)) {
      return
    }

    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)

    // Follow all exec edges
    const outgoingEdges = indexed.outgoingExecByNode.get(nodeId) ?? []
    for (const edge of outgoingEdges) {
      dfs(edge.targetNodeId)
    }

    path.pop()
    recursionStack.delete(nodeId)
  }

  // Start DFS from all entry points
  for (const entryId of indexed.entries) {
    dfs(entryId)
  }

  // Also check nodes not reachable from entries (orphan cycles)
  for (const nodeId of indexed.nodesById.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId)
    }
  }

  return {
    hasCycle: cycles.length > 0,
    cycles: cycles.map((cycle) => [...cycle]),
  }
}

/**
 * Detect cycles in the data flow of a graph.
 * This checks for circular data dependencies.
 *
 * Time complexity: O(V+E)
 * Space complexity: O(V)
 *
 * @param indexed - The indexed graph
 * @returns Cycle detection result with all cycles found
 */
export function detectDataCycles(indexed: IndexedGraph): CycleDetectionResult {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(nodeId: string): void {
    if (recursionStack.has(nodeId)) {
      // Found a cycle
      const cycleStart = path.indexOf(nodeId)
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart)
        cycle.push(nodeId)
        cycles.push(cycle)
      }
      return
    }

    if (visited.has(nodeId)) {
      return
    }

    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)

    // Follow all data edges
    const outgoingEdges = indexed.outgoingDataByNode.get(nodeId) ?? []
    for (const edge of outgoingEdges) {
      dfs(edge.targetNodeId)
    }

    path.pop()
    recursionStack.delete(nodeId)
  }

  // Check all nodes as potential start points
  for (const nodeId of indexed.nodesById.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId)
    }
  }

  return {
    hasCycle: cycles.length > 0,
    cycles: cycles.map((cycle) => [...cycle]),
  }
}

/**
 * Detect cycles in a local data dependency subgraph.
 * Used when resolving data dependencies for a specific node.
 *
 * @param nodeIds - Set of node IDs in the local subgraph
 * @param getOutgoingEdges - Function to get outgoing data edges for a node
 * @returns Array of cycles, each as array of node IDs
 */
export function detectLocalDataCycles(
  nodeIds: ReadonlySet<string>,
  getOutgoingEdges: (
    nodeId: string,
  ) => readonly { readonly targetNodeId: string }[],
): readonly string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(nodeId: string): void {
    if (recursionStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId)
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart)
        cycle.push(nodeId)
        cycles.push(cycle)
      }
      return
    }

    if (visited.has(nodeId)) {
      return
    }

    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)

    const outgoingEdges = getOutgoingEdges(nodeId)
    for (const edge of outgoingEdges) {
      if (nodeIds.has(edge.targetNodeId)) {
        dfs(edge.targetNodeId)
      }
    }

    path.pop()
    recursionStack.delete(nodeId)
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      dfs(nodeId)
    }
  }

  return cycles
}

/**
 * Format a cycle as a human-readable string for diagnostics.
 */
export function formatCycle(cycle: readonly string[]): string {
  if (cycle.length === 0) return ''
  if (cycle.length === 1) return cycle[0] ?? ''

  // Remove the duplicate closing node for display
  const displayNodes =
    cycle[0] === cycle[cycle.length - 1] ? cycle.slice(0, -1) : cycle

  return displayNodes.join(' → ')
}

/**
 * Find the first cycle involving a specific node.
 */
export function findCycleContainingNode(
  indexed: IndexedGraph,
  targetNodeId: string,
  edgeType: 'exec' | 'data' = 'exec',
): string[] | null {
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(nodeId: string): string[] | null {
    if (nodeId === targetNodeId && recursionStack.has(nodeId)) {
      // Found cycle back to target
      const cycleStart = path.indexOf(nodeId)
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart)
        cycle.push(nodeId)
        return [...cycle]
      }
      return null
    }

    if (recursionStack.has(nodeId)) {
      return null // Different cycle
    }

    if (visited.has(nodeId)) {
      return null
    }

    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)

    const outgoingEdges =
      edgeType === 'exec'
        ? (indexed.outgoingExecByNode.get(nodeId) ?? [])
        : (indexed.outgoingDataByNode.get(nodeId) ?? [])

    for (const edge of outgoingEdges) {
      const result = dfs(edge.targetNodeId)
      if (result) {
        return result
      }
    }

    path.pop()
    recursionStack.delete(nodeId)
    return null
  }

  // Start from target node
  return dfs(targetNodeId)
}
