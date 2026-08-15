// ============================================
import { requireIndexedGraph } from '@/features/lua-generator/__tests__/utils/graph-index-assertions'
// Tests for Data Dependencies
// ============================================

import { describe, expect, it } from 'vitest'
import { GraphBuilder } from '@/features/lua-generator/__tests__/utils/graph-builder'
import { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import { createDefaultActionConfig } from '@/shared/types'
import {
  createLiteralBinding,
  createTempBinding,
  resolveDataDependencies,
} from '../data-dependencies'
import { buildGraphIndexes } from '../indexes'
import type { LuaValueRef } from '../types'

describe('resolveDataDependencies', () => {
  it('should return empty bindings for node with no data inputs', () => {
    const graph = new GraphBuilder('test', 'test')
      .startupTrigger('entry', 'On Startup')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)
    const collector = new DiagnosticsCollector()

    const result = resolveDataDependencies(
      'entry',
      indexed,
      new Map(),
      new Set(),
      collector,
    )

    expect(result).not.toBeNull()
    expect(result?.dependencies).toHaveLength(0)
    expect(Object.keys(result?.bindings ?? {})).toHaveLength(0)
    expect(collector.hasErrors()).toBe(false)
  })

  it('should generate temp variable names for data dependencies', () => {
    const graph = new GraphBuilder('test', 'test')
      .codeBlock(
        'source',
        'return 42',
        [],
        [{ id: 'out1', name: 'Output', dataType: 'number' }],
      )
      .action(
        'target',
        'set-variable',
        {
          ...createDefaultActionConfig('set-variable'),
          scope: 'g',
          variableName: 'result',
          valueType: 'number',
          value: 0,
        },
        'Target',
      )
      .connectData('source', 'out1', 'target', 'value')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)
    const collector = new DiagnosticsCollector()

    const result = resolveDataDependencies(
      'target',
      indexed,
      new Map(),
      new Set(),
      collector,
    )

    expect(result).not.toBeNull()
    expect(Object.keys(result?.bindings ?? {})).toContain('value')
    expect(collector.hasErrors()).toBe(false)
  })

  it('should detect data cycles', () => {
    // Create a graph with a data cycle: a -> b -> a
    const graph = new GraphBuilder('test', 'test')
      .codeBlock(
        'a',
        'return 1',
        [{ id: 'in1', name: 'Input', dataType: 'number' }],
        [{ id: 'out1', name: 'Output', dataType: 'number' }],
      )
      .codeBlock(
        'b',
        'return 2',
        [{ id: 'in1', name: 'Input', dataType: 'number' }],
        [{ id: 'out1', name: 'Output', dataType: 'number' }],
      )
      // Create cycle: a.out1 -> b.in1, b.out1 -> a.in1
      .connectData('a', 'out1', 'b', 'in1')
      .connectData('b', 'out1', 'a', 'in1')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)
    const collector = new DiagnosticsCollector()

    // Try to resolve dependencies for node 'a' which is in a cycle
    resolveDataDependencies('a', indexed, new Map(), new Set(), collector)

    expect(collector.hasErrors()).toBe(true)
    const errors = collector.getErrors()
    expect(errors.some((e) => e.id === 'data-cycle-detected')).toBe(true)
  })

  it('should use existing value bindings when available', () => {
    const graph = new GraphBuilder('test', 'test')
      .codeBlock(
        'source',
        'return 42',
        [],
        [{ id: 'out1', name: 'Output', dataType: 'number' }],
      )
      .action(
        'target',
        'set-variable',
        {
          ...createDefaultActionConfig('set-variable'),
          scope: 'g',
          variableName: 'result',
          valueType: 'number',
          value: 0,
        },
        'Target',
      )
      .connectData('source', 'out1', 'target', 'value')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)
    const collector = new DiagnosticsCollector()

    // Pre-populate a value binding
    const valueBindings = new Map<string, LuaValueRef>()
    valueBindings.set('source:out1', { kind: 'temp', name: '_my_var_123' })

    const result = resolveDataDependencies(
      'target',
      indexed,
      valueBindings,
      new Set(['_my_var_123']),
      collector,
    )

    expect(result).not.toBeNull()
    expect(result?.bindings['value']).toBe('_my_var_123')
    expect(collector.hasErrors()).toBe(false)
  })
})

describe('createLiteralBinding', () => {
  it('should create a literal value reference', () => {
    const binding = createLiteralBinding('42')
    expect(binding.kind).toBe('literal')
    if (binding.kind === 'literal') {
      expect(binding.lua).toBe('42')
    }
  })
})

describe('createTempBinding', () => {
  it('should create a temp variable reference', () => {
    const binding = createTempBinding('_ns_node_result')
    expect(binding.kind).toBe('temp')
    if (binding.kind === 'temp') {
      expect(binding.name).toBe('_ns_node_result')
    }
  })
})
