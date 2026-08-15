// src/features/lua-generator/generators/nodes/__tests__/return.test.ts
// Tests for return node generator

import { describe, expect, it } from 'vitest'
import type { CallablePort, GraphNode, ReturnNodeData } from '@/shared/types'
import { returnGenerator } from '../return'
import { createMockContext } from './helpers/mock-context'

function createReturnNode(
  id: string,
  returnValues: CallablePort[] = [],
): GraphNode<ReturnNodeData> {
  return {
    id,
    type: 'return',
    definitionId: `return-${id}`,
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'return',
      returnValues,
    },
  }
}

function createPort(
  id: string,
  name: string,
  dataType: CallablePort['dataType'] = 'any',
): CallablePort {
  return { id, name, dataType }
}

describe('returnGenerator', () => {
  it('should generate empty return for no values', () => {
    const node = createReturnNode('ret1')

    const { context } = createMockContext({
      graphId: 'graph-1',
      callableSymbolByGraphId: new Map([['graph-1', '_nvimset_graph_1']]),
    })

    const unit = returnGenerator.generate(node, context)

    expect(unit.code).toContain('return {}')
  })

  it('should generate return with single value', () => {
    const node = createReturnNode('ret2', [createPort('r1', 'result')])

    const { context } = createMockContext({
      graphId: 'graph-2',
      callableSymbolByGraphId: new Map([['graph-2', '_nvimset_graph_2']]),
      inputBindings: {
        r1: 'computedValue',
      },
    })

    const unit = returnGenerator.generate(node, context)

    expect(unit.code).toContain('return { ["r1"] = computedValue }')
  })

  it('should generate return with multiple values', () => {
    const node = createReturnNode('ret3', [
      createPort('r1', 'first'),
      createPort('r2', 'second'),
      createPort('r3', 'third'),
    ])

    const { context } = createMockContext({
      graphId: 'graph-3',
      callableSymbolByGraphId: new Map([['graph-3', '_nvimset_graph_3']]),
      inputBindings: {
        r1: 'val1',
        r2: 'val2',
        r3: 'val3',
      },
    })

    const unit = returnGenerator.generate(node, context)

    expect(unit.code).toContain('return {')
    expect(unit.code.some((line) => line.includes('["r1"] = val1'))).toBe(true)
    expect(unit.code.some((line) => line.includes('["r2"] = val2'))).toBe(true)
    expect(unit.code.some((line) => line.includes('["r3"] = val3'))).toBe(true)
    expect(unit.code).toContain('}')
  })

  it('should return nil for unconnected return values', () => {
    const node = createReturnNode('ret4', [
      createPort('r1', 'connected'),
      createPort('r2', 'unconnected'),
    ])

    const { context } = createMockContext({
      graphId: 'graph-4',
      callableSymbolByGraphId: new Map([['graph-4', '_nvimset_graph_4']]),
      inputBindings: {
        r1: 'someValue',
        // r2 is not bound
      },
    })

    const unit = returnGenerator.generate(node, context)

    expect(unit.code.some((line) => line.includes('["r1"] = someValue'))).toBe(
      true,
    )
    expect(unit.code.some((line) => line.includes('["r2"] = nil'))).toBe(true)
  })

  it('should emit warning when outside callable graph', () => {
    const node = createReturnNode('ret5', [createPort('r1', 'value')])

    const { context, getEmittedDiagnostics } = createMockContext({
      graphId: 'graph-5',
      callableSymbolByGraphId: new Map(), // No symbol for this graph
      inputBindings: {
        r1: '42',
      },
    })

    const unit = returnGenerator.generate(node, context)

    // Still generates the return statement
    expect(unit.code).toContain('return { ["r1"] = 42 }')

    // But emits a warning
    const diagnostics = getEmittedDiagnostics()
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.id).toBe('return-outside-callable')
    expect(diagnostics[0]?.severity).toBe('warning')
  })

  it('should handle expressions as return values', () => {
    const node = createReturnNode('ret6', [
      createPort('r1', 'sum'),
      createPort('r2', 'product'),
    ])

    const { context } = createMockContext({
      graphId: 'graph-6',
      callableSymbolByGraphId: new Map([['graph-6', '_nvimset_graph_6']]),
      inputBindings: {
        r1: 'a + b',
        r2: 'x * y',
      },
    })

    const unit = returnGenerator.generate(node, context)

    expect(unit.code.some((line) => line.includes('["r1"] = a + b'))).toBe(true)
    expect(unit.code.some((line) => line.includes('["r2"] = x * y'))).toBe(true)
  })

  it('should use port id (not name) for table keys', () => {
    const node = createReturnNode('ret7', [
      createPort('port-abc', 'displayName'),
    ])

    const { context } = createMockContext({
      graphId: 'graph-7',
      callableSymbolByGraphId: new Map([['graph-7', '_nvimset_graph_7']]),
      inputBindings: {
        'port-abc': 'value',
      },
    })

    const unit = returnGenerator.generate(node, context)

    // Should use port id as key, not name
    expect(
      unit.code.some((line) => line.includes('["port-abc"] = value')),
    ).toBe(true)
  })
})
