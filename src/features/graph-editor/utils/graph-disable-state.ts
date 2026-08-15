import type {
  DisableComputationResult,
  Graph,
  GraphDisableState,
  GraphEffectiveState,
} from '@/shared/types'

/**
 * Compute transitive disable states for all graphs using reverse adjacency + BFS.
 *
 * Time Complexity: O(V + E)
 * - Build maps/adjacency: O(V + E)
 * - BFS traversal: O(V + E) - each graph enqueued at most once, each edge visited at most once
 *
 * Memory Complexity: O(V + E)
 * - byId map: O(V)
 * - reverseAdj map: O(E)
 * - states map: O(V)
 * - queue: O(V)
 *
 * @param graphs - All graphs in the project
 * @returns Map of graphId -> GraphDisableState with computed effective states
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: O(V+E) BFS algorithm — splitting would obscure the graph traversal logic
export function computeDisableStates(
  graphs: readonly Graph[],
): DisableComputationResult {
  const byId = new Map<string, Graph>()
  const reverseAdj = new Map<string, string[]>()
  const states = new Map<string, GraphDisableState>()

  // Build lookup + initialize reverse adjacency slots
  for (const graph of graphs) {
    byId.set(graph.id, graph)
    reverseAdj.set(graph.id, [])
  }

  // Build reverse adjacency: target -> dependents
  // For each graph-ref node, add an edge from target graph to the referencing graph
  for (const graph of graphs) {
    for (const node of graph.nodes) {
      if (node.data.nodeType !== 'graph-ref') continue
      const targetId = node.data.referencedGraphId
      if (!byId.has(targetId)) continue
      const dependents = reverseAdj.get(targetId)
      if (dependents !== undefined) {
        dependents.push(graph.id)
      }
    }
  }

  // Initialize states from user intent and queue all user-disabled roots
  const queue: Array<{ graphId: string; rootId: string }> = []
  const blockedByRoot = new Map<string, string>()

  for (const graph of graphs) {
    const userEnabled = graph.enabled
    if (!userEnabled) {
      const effectiveState: GraphEffectiveState = { kind: 'user-disabled' }
      states.set(graph.id, {
        graphId: graph.id,
        userEnabled,
        effective: effectiveState,
      })
      queue.push({ graphId: graph.id, rootId: graph.id })
      continue
    }

    const effectiveState: GraphEffectiveState = { kind: 'enabled' }
    states.set(graph.id, {
      graphId: graph.id,
      userEnabled,
      effective: effectiveState,
    })
  }

  // BFS over reverse edges to mark dependency-disabled graphs once
  let head = 0
  while (head < queue.length) {
    const current = queue[head]
    head += 1
    if (!current) continue

    const dependents = reverseAdj.get(current.graphId) ?? []
    for (const dependentId of dependents) {
      const dependentGraph = byId.get(dependentId)
      if (!dependentGraph) continue

      // Explicit user disable has priority; do not overwrite
      if (!dependentGraph.enabled) continue

      // Already dependency-disabled; skip to keep O(V + E)
      if (blockedByRoot.has(dependentId)) continue

      blockedByRoot.set(dependentId, current.rootId)

      const rootGraph = byId.get(current.rootId)
      const effectiveState: GraphEffectiveState = {
        kind: 'dependency-disabled',
        blockedByRootId: current.rootId,
        blockedByRootName: rootGraph?.name ?? current.rootId,
      }

      states.set(dependentId, {
        graphId: dependentId,
        userEnabled: true,
        effective: effectiveState,
      })

      queue.push({ graphId: dependentId, rootId: current.rootId })
    }
  }

  return { statesByGraphId: states }
}

/**
 * Type guard to check if a graph is effectively enabled.
 */
export function isGraphEffectivelyEnabled(
  state: GraphDisableState | undefined,
): state is GraphDisableState & { effective: { kind: 'enabled' } } {
  return state?.effective.kind === 'enabled'
}

/**
 * Type guard to check if a graph is dependency-disabled.
 */
export function isGraphDependencyDisabled(
  state: GraphDisableState | undefined,
): state is GraphDisableState & {
  effective: { kind: 'dependency-disabled' }
} {
  return state?.effective.kind === 'dependency-disabled'
}

/**
 * Type guard to check if a graph is user-disabled.
 */
export function isGraphUserDisabled(
  state: GraphDisableState | undefined,
): state is GraphDisableState & { effective: { kind: 'user-disabled' } } {
  return state?.effective.kind === 'user-disabled'
}

/**
 * Get a human-readable description of why a graph is disabled.
 */
export function getDisableReason(state: GraphDisableState | undefined): string {
  if (!state) return ''

  switch (state.effective.kind) {
    case 'enabled':
      return ''
    case 'user-disabled':
      return 'Disabled by you'
    case 'dependency-disabled':
      return `Blocked by: ${state.effective.blockedByRootName}`
    default:
      return ''
  }
}
