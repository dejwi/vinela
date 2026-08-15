// ============================================
import { requireIndexedGraph } from '@/features/lua-generator/__tests__/utils/graph-index-assertions'
// Tests for Cycle Detection
// ============================================

import { describe, expect, it } from 'vitest'
import { GraphBuilder } from '@/features/lua-generator/__tests__/utils/graph-builder'
import {
  detectDataCycles,
  detectExecCycles,
  findCycleContainingNode,
  formatCycle,
} from '../cycle-detection'
import { buildGraphIndexes } from '../indexes'

describe('detectExecCycles', () => {
  it('should return no cycles for linear graph', () => {
    const graph = new GraphBuilder('test', 'test')
      .startupTrigger('entry', 'On Startup')
      .codeBlock('a', 'print(1)', [], [], 'A')
      .codeBlock('b', 'print(2)', [], [], 'B')
      .codeBlock('c', 'print(3)', [], [], 'C')
      .connectExec('entry', 'a')
      .connectExec('a', 'b')
      .connectExec('b', 'c')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)

    const result = detectExecCycles(indexed)

    expect(result.hasCycle).toBe(false)
    expect(result.cycles).toHaveLength(0)
  })

  it('should detect simple exec cycle', () => {
    const graph = new GraphBuilder('test', 'test')
      .startupTrigger('entry', 'On Startup')
      .codeBlock('a', 'print(1)', [], [], 'A')
      .codeBlock('b', 'print(2)', [], [], 'B')
      .connectExec('entry', 'a')
      .connectExec('a', 'b')
      .connectExec('b', 'a') // Creates cycle: a -> b -> a
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)

    const result = detectExecCycles(indexed)

    expect(result.hasCycle).toBe(true)
    expect(result.cycles.length).toBeGreaterThan(0)
  })

  it('should detect self-loop cycle', () => {
    const graph = new GraphBuilder('test', 'test')
      .startupTrigger('entry', 'On Startup')
      .codeBlock('a', 'print(1)', [], [], 'A')
      .connectExec('entry', 'a')
      .connectExec('a', 'a') // Self-loop
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)

    const result = detectExecCycles(indexed)

    expect(result.hasCycle).toBe(true)
  })

  it('should detect cycle in disconnected subgraph', () => {
    const graph = new GraphBuilder('test', 'test')
      .startupTrigger('entry', 'On Startup')
      .codeBlock('a', 'print(1)', [], [], 'A') // Reachable
      .codeBlock('x', 'print(2)', [], [], 'X') // Unreachable but part of cycle
      .codeBlock('y', 'print(3)', [], [], 'Y')
      .connectExec('entry', 'a')
      .connectExec('x', 'y')
      .connectExec('y', 'x') // Creates cycle in disconnected component
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)

    const result = detectExecCycles(indexed)

    expect(result.hasCycle).toBe(true)
  })
})

describe('detectDataCycles', () => {
  it('should return no cycles for acyclic data flow', () => {
    const graph = new GraphBuilder('test', 'test')
      .startupTrigger('entry', 'On Startup')
      .codeBlock(
        'source',
        'return 42',
        [],
        [{ id: 'out', name: 'Output', dataType: 'number' }],
      )
      .codeBlock(
        'target',
        'print(x)',
        [{ id: 'in', name: 'Input', dataType: 'number' }],
        [],
      )
      .connectData('source', 'out', 'target', 'in')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)

    const result = detectDataCycles(indexed)

    expect(result.hasCycle).toBe(false)
    expect(result.cycles).toHaveLength(0)
  })

  it('should detect simple data cycle', () => {
    const graph = new GraphBuilder('test', 'test')
      .codeBlock(
        'a',
        'return 1',
        [{ id: 'in', name: 'In', dataType: 'number' }],
        [{ id: 'out', name: 'Out', dataType: 'number' }],
      )
      .codeBlock(
        'b',
        'return 2',
        [{ id: 'in', name: 'In', dataType: 'number' }],
        [{ id: 'out', name: 'Out', dataType: 'number' }],
      )
      .connectData('a', 'out', 'b', 'in')
      .connectData('b', 'out', 'a', 'in') // Creates cycle
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)

    const result = detectDataCycles(indexed)

    expect(result.hasCycle).toBe(true)
    expect(result.cycles.length).toBeGreaterThan(0)
  })
})

describe('formatCycle', () => {
  it('should format cycle with arrows', () => {
    const cycle = ['a', 'b', 'c', 'a']
    const formatted = formatCycle(cycle)
    expect(formatted).toBe('a → b → c')
  })

  it('should handle empty cycle', () => {
    expect(formatCycle([])).toBe('')
  })

  it('should handle single node cycle', () => {
    expect(formatCycle(['a'])).toBe('a')
  })

  it('should handle two node cycle', () => {
    const cycle = ['a', 'b', 'a']
    const formatted = formatCycle(cycle)
    expect(formatted).toBe('a → b')
  })
})

describe('findCycleContainingNode', () => {
  it('should find cycle containing specific node', () => {
    const graph = new GraphBuilder('test', 'test')
      .startupTrigger('entry', 'On Startup')
      .codeBlock('a', 'print(1)', [], [], 'A')
      .codeBlock('b', 'print(2)', [], [], 'B')
      .codeBlock('c', 'print(3)', [], [], 'C')
      .connectExec('entry', 'a')
      .connectExec('a', 'b')
      .connectExec('b', 'c')
      .connectExec('c', 'b') // Cycle: b -> c -> b
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)

    const cycle = findCycleContainingNode(indexed, 'b', 'exec')

    expect(cycle).not.toBeNull()
    expect(cycle).toContain('b')
    expect(cycle).toContain('c')
  })

  it('should return null when node not in cycle', () => {
    const graph = new GraphBuilder('test', 'test')
      .startupTrigger('entry', 'On Startup')
      .codeBlock('a', 'print(1)', [], [], 'A')
      .codeBlock('b', 'print(2)', [], [], 'B')
      .connectExec('entry', 'a')
      .connectExec('a', 'b')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)

    const cycle = findCycleContainingNode(indexed, 'a', 'exec')

    expect(cycle).toBeNull()
  })
})
