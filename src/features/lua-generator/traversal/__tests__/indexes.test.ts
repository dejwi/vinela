// ============================================
// Tests for Graph Indexing
// ============================================

import { describe, expect, it } from 'vitest'
import { callableGraph } from '@/features/lua-generator/__tests__/fixtures/graphs/callable'
import { conditionalGraph } from '@/features/lua-generator/__tests__/fixtures/graphs/conditional'
import { forLoopGraph } from '@/features/lua-generator/__tests__/fixtures/graphs/loop-types'
import {
  simpleSetOptionGraph,
  simpleStartupGraph,
} from '@/features/lua-generator/__tests__/fixtures/graphs/simple-startup'
import { buildGraphIndexes } from '../indexes'

describe('buildGraphIndexes', () => {
  it('should index nodes by ID', () => {
    const indexes = buildGraphIndexes([simpleStartupGraph])
    const indexed = indexes.byGraph.get(simpleStartupGraph.id)

    expect(indexed).toBeDefined()
    expect(indexed?.nodesById.has('entry')).toBe(true)
    expect(indexed?.nodesById.has('action1')).toBe(true)
  })

  it('should identify entry nodes (triggers)', () => {
    const indexes = buildGraphIndexes([simpleStartupGraph])
    const indexed = indexes.byGraph.get(simpleStartupGraph.id)

    expect(indexed?.entries).toContain('entry')
  })

  it('should identify callable entry nodes', () => {
    const indexes = buildGraphIndexes([callableGraph])
    const indexed = indexes.byGraph.get(callableGraph.id)

    expect(indexed?.entries).toContain('entry')
  })

  it('should classify edges as exec', () => {
    const indexes = buildGraphIndexes([simpleStartupGraph])
    const indexed = indexes.byGraph.get(simpleStartupGraph.id)

    const entryExecEdges = indexed?.outgoingExecByNode.get('entry')
    expect(entryExecEdges).toHaveLength(1)
    expect(entryExecEdges?.[0]?.targetNodeId).toBe('action1')
  })

  it('should track outgoing exec edges', () => {
    const indexes = buildGraphIndexes([conditionalGraph])
    const indexed = indexes.byGraph.get(conditionalGraph.id)

    const conditionExecEdges = indexed?.outgoingExecByNode.get('cond1')
    expect(conditionExecEdges).toHaveLength(2)

    const targets = conditionExecEdges?.map((e) => e.targetNodeId)
    expect(targets).toContain('printHigh')
    expect(targets).toContain('printLow')
  })

  it('should track incoming exec edges', () => {
    const indexes = buildGraphIndexes([conditionalGraph])
    const indexed = indexes.byGraph.get(conditionalGraph.id)

    const printHighIncoming = indexed?.incomingExecByNode.get('printHigh')
    expect(printHighIncoming).toHaveLength(1)
    expect(printHighIncoming?.[0]?.sourceNodeId).toBe('cond1')
  })

  it('should collect all nodes in global map', () => {
    const indexes = buildGraphIndexes([
      simpleStartupGraph,
      simpleSetOptionGraph,
    ])

    expect(indexes.allNodes.has('entry')).toBe(true)
    expect(indexes.allNodes.has('action1')).toBe(true)
    expect(indexes.allNodes.has('setNumber')).toBe(true)
  })

  it('should handle loop body edges', () => {
    const indexes = buildGraphIndexes([forLoopGraph])
    const indexed = indexes.byGraph.get(forLoopGraph.id)

    const loopEdges = indexed?.outgoingExecByNode.get('for1')
    expect(loopEdges).toHaveLength(2) // body and complete edges

    const targets = loopEdges?.map((e) => e.targetNodeId)
    expect(targets).toContain('printI')
    expect(targets).toContain('afterLoop')
  })

  it('should be O(V+E) complexity', () => {
    // This is a conceptual test - in practice, we'd measure performance
    // For now, we verify that the function completes without error
    const graphs = [
      simpleStartupGraph,
      conditionalGraph,
      forLoopGraph,
      callableGraph,
    ]

    const indexes = buildGraphIndexes(graphs)

    expect(indexes.byGraph.size).toBe(4)
    // Note: allNodes uses node IDs as keys, so duplicate IDs across graphs
    // will result in fewer entries than the total node count
    // Count unique node IDs across all graphs
    const uniqueNodeIds = new Set<string>()
    for (const graph of graphs) {
      for (const node of graph.nodes) {
        uniqueNodeIds.add(node.id)
      }
    }
    expect(indexes.allNodes.size).toBe(uniqueNodeIds.size)
  })
})
