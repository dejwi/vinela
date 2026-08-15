// src/features/lua-generator/generators/nodes/__tests__/callable-entry.test.ts
// Tests for callable entry node generator

import { describe, expect, it } from 'vitest'
import { expectedCallableRef } from '@/features/lua-generator/__tests__/utils/callable-keys'
import type {
  CallableEntryNodeData,
  CallablePort,
  GraphNode,
} from '@/shared/types'
import { callableEntryGenerator } from '../callable-entry'
import { createMockContext } from './helpers/mock-context'

function createCallableEntryNode(
  id: string,
  parameters: CallablePort[] = [],
): GraphNode<CallableEntryNodeData> {
  return {
    id,
    type: 'callable-entry',
    definitionId: `callable-entry-${id}`,
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'callable-entry',
      parameters,
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

describe('callableEntryGenerator', () => {
  it('should generate function with no parameters', () => {
    const node = createCallableEntryNode('entry1')

    const { context } = createMockContext({
      graphId: 'graph-1',
      callableSymbolByGraphId: new Map([['graph-1', '_nvimset_graph_1']]),
      renderExecFromPort: () => ['print("hello")'],
    })

    const unit = callableEntryGenerator.generate(node, context)
    expect(unit.code).toContain(
      `${expectedCallableRef('graph-1', 'graph-1')} = function(params)`,
    )
    expect(unit.code).toContain('  print("hello")')
    expect(unit.code).toContain('end')
    expect(unit.outputBindings).toEqual({})
  })

  it('should generate function with single parameter', () => {
    const node = createCallableEntryNode('entry2', [
      createPort('p1', 'message'),
    ])

    const { context } = createMockContext({
      graphId: 'graph-2',
      callableSymbolByGraphId: new Map([['graph-2', '_nvimset_graph_2']]),
      renderExecFromPort: () => ['print(message)'],
    })

    const unit = callableEntryGenerator.generate(node, context)
    expect(unit.code).toContain(
      `${expectedCallableRef('graph-2', 'graph-2')} = function(params)`,
    )
    expect(unit.code).toContain('  local param_p1 = params["p1"]')
    expect(unit.code).toContain('  print(message)')
    expect(unit.outputBindings).toHaveProperty('p1')
    expect(unit.localVars).toContain(unit.outputBindings['p1'])
  })

  it('should generate function with multiple parameters', () => {
    const node = createCallableEntryNode('entry3', [
      createPort('p1', 'firstName'),
      createPort('p2', 'lastName'),
      createPort('p3', 'age', 'number'),
    ])

    const { context } = createMockContext({
      graphId: 'graph-3',
      callableSymbolByGraphId: new Map([['graph-3', '_nvimset_graph_3']]),
      renderExecFromPort: () => ['print(firstName, lastName, age)'],
    })

    const unit = callableEntryGenerator.generate(node, context)
    expect(
      unit.code.some((line) => line.includes('param_p1 = params["p1"]')),
    ).toBe(true)
    expect(
      unit.code.some((line) => line.includes('param_p2 = params["p2"]')),
    ).toBe(true)
    expect(
      unit.code.some((line) => line.includes('param_p3 = params["p3"]')),
    ).toBe(true)
    expect(Object.keys(unit.outputBindings)).toHaveLength(3)
  })

  it('should resolve parameters by stable port ID', () => {
    const node = createCallableEntryNode('entry4', [
      createPort('p1', 'my-param'),
      createPort('p2', 'param.with.dots'),
    ])

    const { context } = createMockContext({
      graphId: 'graph-4',
      callableSymbolByGraphId: new Map([['graph-4', '_nvimset_graph_4']]),
      renderExecFromPort: () => [],
    })

    const unit = callableEntryGenerator.generate(node, context)

    // Parameter lookup keys are stable IDs, not user-editable names
    expect(
      unit.code.some((line) => line.includes('param_p1 = params["p1"]')),
    ).toBe(true)
    expect(
      unit.code.some((line) => line.includes('param_p2 = params["p2"]')),
    ).toBe(true)
  })

  it('should emit error when no callable symbol is registered', () => {
    const node = createCallableEntryNode('entry5')

    const { context, diagnostics } = createMockContext({
      graphId: 'graph-5',
      callableSymbolByGraphId: new Map(), // Empty map - no symbol
      renderExecFromPort: () => [],
    })

    const unit = callableEntryGenerator.generate(node, context)

    expect(unit.code).toHaveLength(0)
    expect(diagnostics.hasErrors()).toBe(true)

    const errors = diagnostics.getErrors()
    expect(errors).toHaveLength(1)
    expect(errors[0]?.id).toBe('callable-entry-no-symbol')
  })

  it('should handle empty body', () => {
    const node = createCallableEntryNode('entry6')

    const { context } = createMockContext({
      graphId: 'graph-6',
      callableSymbolByGraphId: new Map([['graph-6', '_nvimset_graph_6']]),
      renderExecFromPort: () => [],
    })

    const unit = callableEntryGenerator.generate(node, context)
    expect(unit.code).toContain(
      `${expectedCallableRef('graph-6', 'graph-6')} = function(params)`,
    )
    expect(unit.code).toContain('end')
  })

  it('should include parameter materialization before body', () => {
    const node = createCallableEntryNode('entry7', [createPort('p1', 'input')])

    const { context } = createMockContext({
      graphId: 'graph-7',
      callableSymbolByGraphId: new Map([['graph-7', '_nvimset_graph_7']]),
      renderExecFromPort: () => ['line1', 'line2'],
    })

    const unit = callableEntryGenerator.generate(node, context)

    const codeStr = unit.code.join('\n')
    const paramIndex = codeStr.indexOf('local param_p1')
    const bodyIndex = codeStr.indexOf('line1')

    expect(paramIndex).toBeGreaterThan(-1)
    expect(bodyIndex).toBeGreaterThan(-1)
    expect(paramIndex).toBeLessThan(bodyIndex)
  })
})
