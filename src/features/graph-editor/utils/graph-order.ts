/**
 * Stable sort graphs by order, then updatedAt descending, then id ascending.
 * Returns a new sorted array.
 */
export function sortGraphsByOrder<
  T extends { order: number; updatedAt: number; id: string },
>(graphs: readonly T[]): T[] {
  return [...graphs].sort((a, b) => {
    // Primary: order ascending
    if (a.order !== b.order) {
      return a.order - b.order
    }
    // Secondary: updatedAt descending (more recent first)
    if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt - a.updatedAt
    }
    // Tertiary: id ascending (deterministic tie-breaker)
    return a.id.localeCompare(b.id)
  })
}

/**
 * Assign contiguous order values [0..n-1] to all graphs.
 * Mutates the order field in-place.
 */
export function assignContiguousOrder<T extends { order: number }>(
  graphs: T[],
): void {
  for (let i = 0; i < graphs.length; i++) {
    const graph = graphs[i]
    if (graph !== undefined) {
      graph.order = i
    }
  }
}

/**
 * Reorder a graph from oldIndex to newIndex in an array.
 * Returns the new array with updated order values.
 * Bounds-safe: returns original array if indices are invalid.
 */
export function reorderGraphs<T extends { id: string; order: number }>(
  graphs: readonly T[],
  activeId: string,
  overId: string,
): T[] {
  const oldIndex = graphs.findIndex((g) => g.id === activeId)
  const newIndex = graphs.findIndex((g) => g.id === overId)

  // Bounds safety checks
  if (
    oldIndex < 0 ||
    newIndex < 0 ||
    oldIndex >= graphs.length ||
    newIndex >= graphs.length ||
    oldIndex === newIndex
  ) {
    return [...graphs]
  }

  const result = [...graphs]
  const moved = result[oldIndex]
  if (moved === undefined) {
    return [...graphs]
  }
  result.splice(oldIndex, 1)
  result.splice(newIndex, 0, moved)

  // Reassign contiguous order values
  assignContiguousOrder(result)

  return result
}

/**
 * Compute order updates from a reordered array.
 * Only returns entries where the order actually changed.
 */
export function computeOrderUpdates<T extends { id: string; order: number }>(
  original: readonly T[],
  reordered: readonly T[],
): Array<{ graphId: string; order: number }> {
  const originalOrderById = new Map(original.map((g) => [g.id, g.order]))
  const updates: Array<{ graphId: string; order: number }> = []

  for (const graph of reordered) {
    const originalOrder = originalOrderById.get(graph.id)
    if (originalOrder !== undefined && originalOrder !== graph.order) {
      updates.push({ graphId: graph.id, order: graph.order })
    }
  }

  return updates
}

/**
 * Validate that order indices are within bounds.
 */
export function isValidOrderIndex(index: number, length: number): boolean {
  return index >= 0 && index < length
}

/**
 * Get the next available order value for a new graph.
 * Returns the maximum existing order + 1, or 0 if no graphs.
 */
export function getNextOrderValue(
  graphs: readonly { order: number }[],
): number {
  if (graphs.length === 0) return 0
  return Math.max(...graphs.map((g) => g.order)) + 1
}
