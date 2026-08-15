// ============================================
// Integration Tests for Graph Traversal
// ============================================

import { describe, expect, it } from 'vitest'
import {
  createCallablePort,
  GraphBuilder,
} from '@/features/lua-generator/__tests__/utils/graph-builder'
import { requireIndexedGraph } from '@/features/lua-generator/__tests__/utils/graph-index-assertions'
import { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import { createDefaultActionConfig } from '@/shared/types'
import { detectDataCycles, detectExecCycles } from '../cycle-detection'
import { resolveDataDependencies } from '../data-dependencies'
import { traverseExecFlow } from '../exec-traversal'
import { buildGraphIndexes } from '../indexes'
import type { TraversalGenerationContext } from '../types'

describe('Graph Traversal Integration', () => {
  const createContext = (graphId: string): TraversalGenerationContext => ({
    currentGraphId: graphId,
    indentLevel: 0,
    variableCounter: 0,
    graphContracts: new Map(),
  })

  describe('Linear Chain', () => {
    it('should fully traverse a linear execution chain', () => {
      const graph = new GraphBuilder('linear', 'linear')
        .startupTrigger('entry', 'On Startup')
        .codeBlock('step1', 'print(1)', [], [], 'Step 1')
        .codeBlock('step2', 'print(2)', [], [], 'Step 2')
        .codeBlock('step3', 'print(3)', [], [], 'Step 3')
        .connectExec('entry', 'step1')
        .connectExec('step1', 'step2')
        .connectExec('step2', 'step3')
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)
      const collector = new DiagnosticsCollector()

      const units = traverseExecFlow(
        'entry',
        indexed,
        createContext(graph.id),
        collector,
      )

      expect(collector.hasErrors()).toBe(false)
      expect(units).toHaveLength(4) // entry, step1, step2, step3
      expect(units.map((u) => u.nodeId)).toEqual([
        'entry',
        'step1',
        'step2',
        'step3',
      ])
    })
  })

  describe('Branching Structure', () => {
    it('should traverse both branches of a condition', () => {
      const graph = new GraphBuilder('branch', 'branch')
        .startupTrigger('entry', 'On Startup')
        .condition('check', '>', 'x', '0', 'Is Positive')
        .codeBlock('trueBranch', 'print("positive")', [], [], 'True')
        .codeBlock('falseBranch', 'print("not positive")', [], [], 'False')
        .codeBlock('merge', 'print("done")', [], [], 'Merge')
        .connectExec('entry', 'check')
        .connectTrue('check', 'trueBranch')
        .connectFalse('check', 'falseBranch')
        .connectExec('trueBranch', 'merge')
        .connectExec('falseBranch', 'merge')
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)
      const collector = new DiagnosticsCollector()

      const units = traverseExecFlow(
        'entry',
        indexed,
        createContext(graph.id),
        collector,
      )

      expect(collector.hasErrors()).toBe(false)
      expect(units.some((u) => u.nodeId === 'entry')).toBe(true)
      expect(units.some((u) => u.nodeId === 'check')).toBe(true)
      expect(units.some((u) => u.nodeId === 'trueBranch')).toBe(true)
      expect(units.some((u) => u.nodeId === 'falseBranch')).toBe(true)
      expect(units.some((u) => u.nodeId === 'merge')).toBe(true)
    })
  })

  describe('Loop Structure', () => {
    it('should traverse loop with body and completion', () => {
      const graph = new GraphBuilder('loop', 'loop')
        .startupTrigger('entry', 'On Startup')
        .loop('count', 'for', 'i', '1, 10', 'Count')
        .codeBlock('body', 'print(i)', [], [], 'Body')
        .codeBlock('after', 'print("done")', [], [], 'After')
        .connectExec('entry', 'count')
        .connectLoopBody('count', 'body')
        .connectLoopComplete('count', 'after')
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)
      const collector = new DiagnosticsCollector()

      const units = traverseExecFlow(
        'entry',
        indexed,
        createContext(graph.id),
        collector,
      )

      expect(collector.hasErrors()).toBe(false)
      expect(units.some((u) => u.nodeId === 'count')).toBe(true)
      expect(units.some((u) => u.nodeId === 'body')).toBe(true)
      expect(units.some((u) => u.nodeId === 'after')).toBe(true)
    })
  })

  describe('Data Flow Integration', () => {
    it('should resolve data dependencies across nodes', () => {
      const graph = new GraphBuilder('data', 'data')
        .startupTrigger('entry', 'On Startup')
        .codeBlock(
          'source',
          'return 42',
          [],
          [{ id: 'value', name: 'Value', dataType: 'number' }],
        )
        .action(
          'consumer',
          'set-variable',
          {
            ...createDefaultActionConfig('set-variable'),
            scope: 'g',
            variableName: 'result',
            valueType: 'number',
            value: 0,
          },
          'Consumer',
        )
        .connectData('source', 'value', 'consumer', 'value')
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)
      const collector = new DiagnosticsCollector()

      const result = resolveDataDependencies(
        'consumer',
        indexed,
        new Map(),
        new Set(),
        collector,
      )

      expect(collector.hasErrors()).toBe(false)
      expect(result).not.toBeNull()
      expect(result?.bindings['value']).toBeDefined()
    })
  })

  describe('Cycle Detection Integration', () => {
    it('should detect and report exec cycles', () => {
      const graph = new GraphBuilder('cycle', 'cycle')
        .startupTrigger('entry', 'On Startup')
        .codeBlock('a', 'print(1)', [], [], 'A')
        .codeBlock('b', 'print(2)', [], [], 'B')
        .connectExec('entry', 'a')
        .connectExec('a', 'b')
        .connectExec('b', 'a') // Creates cycle
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)

      const cycleResult = detectExecCycles(indexed)

      expect(cycleResult.hasCycle).toBe(true)
      expect(cycleResult.cycles.length).toBeGreaterThan(0)

      // Traversal should also detect the cycle
      const collector = new DiagnosticsCollector()
      traverseExecFlow('entry', indexed, createContext(graph.id), collector)

      expect(collector.hasErrors()).toBe(true)
      expect(
        collector.getErrors().some((e) => e.id === 'exec-cycle-detected'),
      ).toBe(true)
    })

    it('should detect and report data cycles', () => {
      const graph = new GraphBuilder('data-cycle', 'data-cycle')
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
        .connectData('b', 'out', 'a', 'in') // Creates data cycle
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)

      const cycleResult = detectDataCycles(indexed)

      expect(cycleResult.hasCycle).toBe(true)
    })
  })

  describe('Complex Graph', () => {
    it('should handle graph with mixed control and data flow', () => {
      const graph = new GraphBuilder('complex', 'complex')
        .startupTrigger('entry', 'On Startup')
        // Data source
        .codeBlock(
          'config',
          'return { enabled = true }',
          [],
          [{ id: 'enabled', name: 'Enabled', dataType: 'boolean' }],
        )
        // Condition using the data
        .condition('check', '==', 'config.enabled', 'true', 'Is Enabled')
        // True branch
        .action(
          'enableFeature',
          'set-option',
          {
            ...createDefaultActionConfig('set-option'),
            optionName: 'feature',
            scope: 'global',
            valueConfig: { valueMode: 'suggested', suggestedValue: true },
          },
          'Enable Feature',
        )
        // False branch
        .action(
          'disableFeature',
          'set-option',
          {
            ...createDefaultActionConfig('set-option'),
            optionName: 'feature',
            scope: 'global',
            valueConfig: { valueMode: 'suggested', suggestedValue: false },
          },
          'Disable Feature',
        )
        // Merge
        .codeBlock('cleanup', 'print("done")', [], [], 'Cleanup')
        // Connections
        .connectExec('entry', 'config')
        .connectExec('config', 'check')
        .connectTrue('check', 'enableFeature')
        .connectFalse('check', 'disableFeature')
        .connectExec('enableFeature', 'cleanup')
        .connectExec('disableFeature', 'cleanup')
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)
      const collector = new DiagnosticsCollector()

      const units = traverseExecFlow(
        'entry',
        indexed,
        createContext(graph.id),
        collector,
      )

      expect(collector.hasErrors()).toBe(false)
      expect(units.length).toBeGreaterThanOrEqual(6)
      expect(units.some((u) => u.nodeId === 'config')).toBe(true)
      expect(units.some((u) => u.nodeId === 'check')).toBe(true)
      expect(units.some((u) => u.nodeId === 'enableFeature')).toBe(true)
      expect(units.some((u) => u.nodeId === 'disableFeature')).toBe(true)
      expect(units.some((u) => u.nodeId === 'cleanup')).toBe(true)
    })
  })

  describe('Callable Graph', () => {
    it('should traverse callable graph structure', () => {
      const graph = new GraphBuilder('callable', 'callable')
        .callableEntry(
          'entry',
          [createCallablePort('input', 'Input', 'string')],
          'Process Input',
        )
        .action(
          'process',
          'set-variable',
          {
            ...createDefaultActionConfig('set-variable'),
            scope: 'g',
            variableName: 'processed',
            valueType: 'string',
            value: 'result',
          },
          'Process',
        )
        .returnNode('ret', [createCallablePort('output', 'Output', 'string')])
        .connectExec('entry', 'process')
        .connectExec('process', 'ret')
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)
      const collector = new DiagnosticsCollector()

      const units = traverseExecFlow(
        'entry',
        indexed,
        createContext(graph.id),
        collector,
      )

      expect(collector.hasErrors()).toBe(false)
      expect(units.some((u) => u.nodeId === 'entry')).toBe(true)
      expect(units.some((u) => u.nodeId === 'process')).toBe(true)
      expect(units.some((u) => u.nodeId === 'ret')).toBe(true)
    })
  })
})
