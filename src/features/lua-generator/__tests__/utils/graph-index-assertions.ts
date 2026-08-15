import type {
  IndexedGraph,
  TraversalGraphIndexes,
} from '@/features/lua-generator/traversal/types'

/**
 * Require a graph index entry built by `buildGraphIndexes`.
 * Throws with graph id context when the index is missing.
 */
export function requireIndexedGraph(
  indexes: TraversalGraphIndexes,
  graphId: string,
): IndexedGraph {
  const indexed = indexes.byGraph.get(graphId)
  if (indexed === undefined) {
    const available = [...indexes.byGraph.keys()].join(', ')
    throw new Error(
      `Expected indexed graph for id ${JSON.stringify(graphId)} (available: ${available || 'none'})`,
    )
  }
  return indexed
}
