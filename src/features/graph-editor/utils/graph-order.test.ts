import { describe, expect, it } from 'vitest'
import {
  assignContiguousOrder,
  computeOrderUpdates,
  getNextOrderValue,
  isValidOrderIndex,
  reorderGraphs,
  sortGraphsByOrder,
} from './graph-order'

interface TestGraph {
  id: string
  order: number
  updatedAt: number
}

function createTestGraph(
  id: string,
  order: number,
  updatedAt: number,
): TestGraph {
  return { id, order, updatedAt }
}

describe('sortGraphsByOrder', () => {
  it('sorts by order ascending', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 2, 100),
      createTestGraph('g2', 0, 100),
      createTestGraph('g3', 1, 100),
    ]

    const sorted = sortGraphsByOrder(graphs)

    expect(sorted.map((g) => g.id)).toEqual(['g2', 'g3', 'g1'])
  })

  it('falls back to updatedAt descending when orders are equal', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 0, 200),
      createTestGraph('g3', 0, 150),
    ]

    const sorted = sortGraphsByOrder(graphs)

    expect(sorted.map((g) => g.id)).toEqual(['g2', 'g3', 'g1'])
  })

  it('falls back to id ascending when order and updatedAt are equal', () => {
    const graphs: TestGraph[] = [
      createTestGraph('c', 0, 100),
      createTestGraph('a', 0, 100),
      createTestGraph('b', 0, 100),
    ]

    const sorted = sortGraphsByOrder(graphs)

    expect(sorted.map((g) => g.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns a new array without mutating original', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 2, 100),
      createTestGraph('g2', 1, 100),
    ]

    const sorted = sortGraphsByOrder(graphs)

    expect(sorted).not.toBe(graphs)
    expect(graphs[0]?.id).toBe('g1') // Original unchanged
  })
})

describe('assignContiguousOrder', () => {
  it('assigns contiguous order values', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 5, 100),
      createTestGraph('g2', 3, 100),
      createTestGraph('g3', 10, 100),
    ]

    assignContiguousOrder(graphs)

    expect(graphs[0]?.order).toBe(0)
    expect(graphs[1]?.order).toBe(1)
    expect(graphs[2]?.order).toBe(2)
  })

  it('handles empty array', () => {
    const graphs: TestGraph[] = []
    assignContiguousOrder(graphs)
    expect(graphs).toEqual([])
  })

  it('mutates the array in place', () => {
    const graphs: TestGraph[] = [createTestGraph('g1', 5, 100)]
    assignContiguousOrder(graphs)
    expect(graphs[0]?.order).toBe(0)
  })
})

describe('reorderGraphs', () => {
  it('moves a graph from one position to another', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 1, 100),
      createTestGraph('g3', 2, 100),
    ]

    const reordered = reorderGraphs(graphs, 'g1', 'g3')

    expect(reordered.map((g) => g.id)).toEqual(['g2', 'g3', 'g1'])
    expect(reordered.map((g) => g.order)).toEqual([0, 1, 2])
  })

  it('handles moving to earlier position', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 1, 100),
      createTestGraph('g3', 2, 100),
    ]

    const reordered = reorderGraphs(graphs, 'g3', 'g1')

    expect(reordered.map((g) => g.id)).toEqual(['g3', 'g1', 'g2'])
  })

  it('returns unchanged array when ids are the same', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 1, 100),
    ]

    const reordered = reorderGraphs(graphs, 'g1', 'g1')

    expect(reordered.map((g) => g.id)).toEqual(['g1', 'g2'])
  })

  it('returns unchanged array when active id not found', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 1, 100),
    ]

    const reordered = reorderGraphs(graphs, 'non-existent', 'g1')

    expect(reordered.map((g) => g.id)).toEqual(['g1', 'g2'])
  })

  it('returns unchanged array when over id not found', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 1, 100),
    ]

    const reordered = reorderGraphs(graphs, 'g1', 'non-existent')

    expect(reordered.map((g) => g.id)).toEqual(['g1', 'g2'])
  })

  it('does not mutate original array', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 1, 100),
    ]

    reorderGraphs(graphs, 'g1', 'g2')

    expect(graphs[0]?.id).toBe('g1')
    expect(graphs[1]?.id).toBe('g2')
  })
})

describe('computeOrderUpdates', () => {
  it('returns only graphs with changed order', () => {
    const original: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 1, 100),
      createTestGraph('g3', 2, 100),
    ]

    const reordered: TestGraph[] = [
      createTestGraph('g1', 0, 100), // unchanged
      createTestGraph('g2', 2, 100), // changed
      createTestGraph('g3', 1, 100), // changed
    ]

    const updates = computeOrderUpdates(original, reordered)

    expect(updates).toHaveLength(2)
    expect(updates).toContainEqual({ graphId: 'g2', order: 2 })
    expect(updates).toContainEqual({ graphId: 'g3', order: 1 })
  })

  it('returns empty array when no changes', () => {
    const original: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 1, 100),
    ]

    const reordered: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 1, 100),
    ]

    const updates = computeOrderUpdates(original, reordered)

    expect(updates).toEqual([])
  })
})

describe('isValidOrderIndex', () => {
  it('returns true for valid indices', () => {
    expect(isValidOrderIndex(0, 5)).toBe(true)
    expect(isValidOrderIndex(4, 5)).toBe(true)
  })

  it('returns false for negative indices', () => {
    expect(isValidOrderIndex(-1, 5)).toBe(false)
  })

  it('returns false for indices >= length', () => {
    expect(isValidOrderIndex(5, 5)).toBe(false)
    expect(isValidOrderIndex(10, 5)).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(isValidOrderIndex(0, 0)).toBe(false)
  })
})

describe('getNextOrderValue', () => {
  it('returns 0 for empty array', () => {
    expect(getNextOrderValue([])).toBe(0)
  })

  it('returns max + 1 for non-empty array', () => {
    const graphs: TestGraph[] = [
      createTestGraph('g1', 0, 100),
      createTestGraph('g2', 5, 100),
      createTestGraph('g3', 2, 100),
    ]

    expect(getNextOrderValue(graphs)).toBe(6)
  })

  it('handles single element', () => {
    const graphs: TestGraph[] = [createTestGraph('g1', 10, 100)]
    expect(getNextOrderValue(graphs)).toBe(11)
  })
})
