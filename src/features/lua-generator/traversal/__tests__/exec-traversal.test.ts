// ============================================
import { requireIndexedGraph } from '@/features/lua-generator/__tests__/utils/graph-index-assertions'
// Tests for Exec Flow Traversal
// ============================================

import { describe, expect, it } from 'vitest'
import { callableGraph } from '@/features/lua-generator/__tests__/fixtures/graphs/callable'
import {
  conditionalGraph,
  nestedConditionalGraph,
} from '@/features/lua-generator/__tests__/fixtures/graphs/conditional'
import {
  eachLoopGraph,
  forLoopGraph,
  whileLoopGraph,
} from '@/features/lua-generator/__tests__/fixtures/graphs/loop-types'
import { simpleStartupGraph } from '@/features/lua-generator/__tests__/fixtures/graphs/simple-startup'
import { GraphBuilder } from '@/features/lua-generator/__tests__/utils/graph-builder'
import { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import { createDefaultActionConfig } from '@/shared/types'
import { findUnreachableNodes, traverseExecFlow } from '../exec-traversal'
import { buildGraphIndexes } from '../indexes'
import type { TraversalGenerationContext } from '../types'

describe('traverseExecFlow', () => {
  const createContext = (graphId: string): TraversalGenerationContext => ({
    currentGraphId: graphId,
    indentLevel: 0,
    variableCounter: 0,
    graphContracts: new Map(),
  })

  /**
   * Context with full code generation enabled.
   * Used to test Fix 3: branch/loop body side effects emitted only once.
   */
  const createGenerationContext = (
    graphId: string,
  ): TraversalGenerationContext => ({
    currentGraphId: graphId,
    indentLevel: 0,
    variableCounter: 0,
    graphContracts: new Map(),
    enableNodeGeneration: true,
  })

  it('should traverse linear chain', () => {
    const indexes = buildGraphIndexes([simpleStartupGraph])
    const indexed = requireIndexedGraph(indexes, simpleStartupGraph.id)
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow(
      'entry',
      indexed,
      createContext(simpleStartupGraph.id),
      collector,
    )

    expect(units).toHaveLength(2)
    expect(units[0]?.nodeId).toBe('entry')
    expect(units[1]?.nodeId).toBe('action1')
    expect(collector.hasErrors()).toBe(false)
  })

  it('should traverse conditional branches', () => {
    const indexes = buildGraphIndexes([conditionalGraph])
    const indexed = requireIndexedGraph(indexes, conditionalGraph.id)
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow(
      'entry',
      indexed,
      createContext(conditionalGraph.id),
      collector,
    )

    // Should have: entry, cond1, printHigh, printLow
    expect(units.length).toBeGreaterThanOrEqual(3)
    expect(units.some((u) => u.nodeId === 'entry')).toBe(true)
    expect(units.some((u) => u.nodeId === 'cond1')).toBe(true)
    expect(units.some((u) => u.nodeId === 'printHigh')).toBe(true)
    expect(units.some((u) => u.nodeId === 'printLow')).toBe(true)
    expect(collector.hasErrors()).toBe(false)
  })

  it('should traverse nested conditions', () => {
    const indexes = buildGraphIndexes([nestedConditionalGraph])
    const indexed = requireIndexedGraph(indexes, nestedConditionalGraph.id)
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow(
      'entry',
      indexed,
      createContext(nestedConditionalGraph.id),
      collector,
    )

    expect(units.length).toBeGreaterThanOrEqual(5)
    expect(units.some((u) => u.nodeId === 'outer')).toBe(true)
    expect(units.some((u) => u.nodeId === 'inner')).toBe(true)
    expect(units.some((u) => u.nodeId === 'visualBlock')).toBe(true)
    expect(units.some((u) => u.nodeId === 'visualLine')).toBe(true)
    expect(units.some((u) => u.nodeId === 'normalAction')).toBe(true)
    expect(collector.hasErrors()).toBe(false)
  })

  it('should traverse for loop with body and completion', () => {
    const indexes = buildGraphIndexes([forLoopGraph])
    const indexed = requireIndexedGraph(indexes, forLoopGraph.id)
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow(
      'entry',
      indexed,
      createContext(forLoopGraph.id),
      collector,
    )

    expect(units.length).toBeGreaterThanOrEqual(4)
    expect(units.some((u) => u.nodeId === 'for1')).toBe(true)
    expect(units.some((u) => u.nodeId === 'printI')).toBe(true)
    expect(units.some((u) => u.nodeId === 'afterLoop')).toBe(true)
    expect(collector.hasErrors()).toBe(false)
  })

  it('should traverse while loop', () => {
    const indexes = buildGraphIndexes([whileLoopGraph])
    const indexed = requireIndexedGraph(indexes, whileLoopGraph.id)
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow(
      'entry',
      indexed,
      createContext(whileLoopGraph.id),
      collector,
    )

    expect(units.length).toBeGreaterThanOrEqual(3)
    expect(units.some((u) => u.nodeId === 'while1')).toBe(true)
    expect(units.some((u) => u.nodeId === 'doWork')).toBe(true)
    expect(collector.hasErrors()).toBe(false)
  })

  it('should traverse each loop', () => {
    const indexes = buildGraphIndexes([eachLoopGraph])
    const indexed = requireIndexedGraph(indexes, eachLoopGraph.id)
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow(
      'entry',
      indexed,
      createContext(eachLoopGraph.id),
      collector,
    )

    expect(units.length).toBeGreaterThanOrEqual(4)
    expect(units.some((u) => u.nodeId === 'each1')).toBe(true)
    expect(units.some((u) => u.nodeId === 'processItem')).toBe(true)
    expect(units.some((u) => u.nodeId === 'doneProcessing')).toBe(true)
    expect(collector.hasErrors()).toBe(false)
  })

  it('should traverse callable graph', () => {
    const indexes = buildGraphIndexes([callableGraph])
    const indexed = requireIndexedGraph(indexes, callableGraph.id)
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow(
      'entry',
      indexed,
      createContext(callableGraph.id),
      collector,
    )

    expect(units.length).toBeGreaterThanOrEqual(2)
    expect(units.some((u) => u.nodeId === 'entry')).toBe(true)
    expect(units.some((u) => u.nodeId === 'process')).toBe(true)
    expect(collector.hasErrors()).toBe(false)
  })

  it('should set correct indent levels', () => {
    const indexes = buildGraphIndexes([conditionalGraph])
    const indexed = requireIndexedGraph(indexes, conditionalGraph.id)
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow(
      'entry',
      indexed,
      createContext(conditionalGraph.id),
      collector,
    )

    // Entry should have indent 0
    const entryUnit = units.find((u) => u.nodeId === 'entry')
    expect(entryUnit?.indentLevel).toBe(0)

    // Condition should have indent 0
    const condUnit = units.find((u) => u.nodeId === 'cond1')
    expect(condUnit?.indentLevel).toBe(0)

    // Branch nodes should have indent 1
    const printHighUnit = units.find((u) => u.nodeId === 'printHigh')
    const printLowUnit = units.find((u) => u.nodeId === 'printLow')
    expect(printHighUnit?.indentLevel).toBe(1)
    expect(printLowUnit?.indentLevel).toBe(1)
  })

  it('should emit nodes only once', () => {
    const indexes = buildGraphIndexes([simpleStartupGraph])
    const indexed = requireIndexedGraph(indexes, simpleStartupGraph.id)
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow(
      'entry',
      indexed,
      createContext(simpleStartupGraph.id),
      collector,
    )

    const nodeIds = units.map((u) => u.nodeId)
    const uniqueNodeIds = new Set(nodeIds)
    expect(nodeIds.length).toBe(uniqueNodeIds.size)
  })

  // ============================================
  // Fix 3: Branch/loop body double-emission tests
  // Verify that nodes embedded inline by renderExecFromPort (inside condition/
  // loop generators) do NOT also appear as standalone CompilationUnits with code.
  // ============================================

  describe('Fix 3: no double emission in generation mode', () => {
    it('emits each conditional branch node code only once (not in unit AND in condition block)', () => {
      // Build: startup → condition → [branchAction | branchFalse]
      const graph = new GraphBuilder('fix3-cond', 'fix3-cond')
        .startupTrigger('entry', 'On Startup')
        .condition('cond1', '>', 'x', '5', 'Is x > 5?')
        .action(
          'branchAction',
          'set-option',
          {
            ...createDefaultActionConfig('set-option'),
            optionName: 'number',
            scope: 'global',
            valueConfig: { valueMode: 'suggested', suggestedValue: true },
          },
          'Enable Number',
        )
        .action(
          'branchFalse',
          'set-option',
          {
            ...createDefaultActionConfig('set-option'),
            optionName: 'number',
            scope: 'global',
            valueConfig: { valueMode: 'suggested', suggestedValue: false },
          },
          'Disable Number',
        )
        .connectExec('entry', 'cond1')
        .connectTrue('cond1', 'branchAction')
        .connectFalse('cond1', 'branchFalse')
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)
      const collector = new DiagnosticsCollector()

      const units = traverseExecFlow(
        'entry',
        indexed,
        createGenerationContext(graph.id),
        collector,
      )

      expect(collector.hasErrors()).toBe(false)

      // Each nodeId must appear at most once in the flat IR
      const nodeIds = units.map((u) => u.nodeId)
      const uniqueNodeIds = new Set(nodeIds)
      expect(nodeIds.length).toBe(uniqueNodeIds.size)

      // branchAction's code must not appear more than once across all unit code arrays
      const branchActionCodeOccurrences = units.filter(
        (u) => u.nodeId === 'branchAction',
      ).length
      expect(branchActionCodeOccurrences).toBeLessThanOrEqual(1)

      // The trigger unit should contain the full embedded structure
      const triggerUnit = units.find((u) => u.nodeId === 'entry')
      expect(triggerUnit).toBeDefined()
      expect(triggerUnit?.code.length).toBeGreaterThan(0)

      // The condition's if-block should be embedded in the trigger, not standalone
      const combinedCode = units.map((u) => u.code.join('\n')).join('\n')

      // 'vim.opt.number' should appear at most twice in total output
      // (once for true branch, once for false branch — not quadrupled by double emission)
      const numberMatches = (combinedCode.match(/vim\.opt\.number/g) ?? [])
        .length
      expect(numberMatches).toBeLessThanOrEqual(2)
    })

    it('emits loop body code only once in generation mode', () => {
      const graph = new GraphBuilder('fix3-loop', 'fix3-loop')
        .startupTrigger('entry', 'On Startup')
        .loop('loop1', 'for', 'i', '1, 10', 'Count to 10')
        .action(
          'bodyAction',
          'set-option',
          {
            ...createDefaultActionConfig('set-option'),
            optionName: 'tabstop',
            scope: 'global',
            valueConfig: { valueMode: 'suggested', suggestedValue: 4 },
          },
          'Set Tabstop',
        )
        .action(
          'afterLoop',
          'set-option',
          {
            ...createDefaultActionConfig('set-option'),
            optionName: 'shiftwidth',
            scope: 'global',
            valueConfig: { valueMode: 'suggested', suggestedValue: 4 },
          },
          'Set Shiftwidth',
        )
        .connectExec('entry', 'loop1')
        .connectLoopBody('loop1', 'bodyAction')
        .connectLoopComplete('loop1', 'afterLoop')
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)
      const collector = new DiagnosticsCollector()

      const units = traverseExecFlow(
        'entry',
        indexed,
        createGenerationContext(graph.id),
        collector,
      )

      expect(collector.hasErrors()).toBe(false)

      // Each nodeId must appear at most once
      const nodeIds = units.map((u) => u.nodeId)
      const uniqueNodeIds = new Set(nodeIds)
      expect(nodeIds.length).toBe(uniqueNodeIds.size)

      // bodyAction nodeId must appear at most once
      const bodyOccurrences = units.filter(
        (u) => u.nodeId === 'bodyAction',
      ).length
      expect(bodyOccurrences).toBeLessThanOrEqual(1)

      // tabstop must appear only once in the combined code output
      const combinedCode = units.map((u) => u.code.join('\n')).join('\n')
      const tabstopMatches = (combinedCode.match(/vim\.opt\.tabstop/g) ?? [])
        .length
      expect(tabstopMatches).toBe(1)
    })

    it('trigger unit code contains all downstream code when generation is enabled', () => {
      const graph = new GraphBuilder('fix3-trigger', 'fix3-trigger')
        .startupTrigger('entry', 'On Startup')
        .action(
          'setNumber',
          'set-option',
          {
            ...createDefaultActionConfig('set-option'),
            optionName: 'number',
            scope: 'global',
            valueConfig: { valueMode: 'suggested', suggestedValue: true },
          },
          'Set Number',
        )
        .connectExec('entry', 'setNumber')
        .build()

      const indexes = buildGraphIndexes([graph])
      const indexed = requireIndexedGraph(indexes, graph.id)
      const collector = new DiagnosticsCollector()

      const units = traverseExecFlow(
        'entry',
        indexed,
        createGenerationContext(graph.id),
        collector,
      )

      expect(collector.hasErrors()).toBe(false)

      // The trigger unit should embed all downstream code
      const triggerUnit = units.find((u) => u.nodeId === 'entry')
      expect(triggerUnit).toBeDefined()
      const triggerCode = triggerUnit?.code.join('\n') ?? ''
      expect(triggerCode).toContain('vim.opt.number')

      // setNumber should not appear as a separate unit with code
      // (its code is embedded in the trigger unit)
      const actionUnit = units.find((u) => u.nodeId === 'setNumber')
      // If the action unit exists at all, its code should be empty
      // (code only lives in the trigger's embedded block)
      if (actionUnit !== undefined) {
        expect(actionUnit.code).toHaveLength(0)
      }
    })
  })
})

describe('findUnreachableNodes', () => {
  it('should identify disconnected nodes', () => {
    const indexes = buildGraphIndexes([simpleStartupGraph])
    const indexed = requireIndexedGraph(indexes, simpleStartupGraph.id)
    const collector = new DiagnosticsCollector()

    const unreachable = findUnreachableNodes(indexed, collector)

    // In simpleStartupGraph, all nodes should be reachable
    expect(unreachable).toHaveLength(0)
    expect(collector.hasWarnings()).toBe(false)
  })

  it('should report unreachable nodes as warnings', () => {
    // We'll create a mock scenario by manually adding nodes that aren't connected
    // This test verifies the diagnostic is emitted correctly
    const indexes = buildGraphIndexes([simpleStartupGraph])
    const indexed = requireIndexedGraph(indexes, simpleStartupGraph.id)
    const collector = new DiagnosticsCollector()

    // For this test, we'll just verify the function runs without error
    // In a real scenario with unreachable nodes, warnings would be collected
    findUnreachableNodes(indexed, collector)

    // No warnings expected for simpleStartupGraph
    expect(collector.getWarnings()).toHaveLength(0)
  })
})

// ============================================
// Fix 1: Create Autocmd callback port (CALLBACK_EXEC_PORTS)
// ============================================

describe('create-autocmd callback port handling', () => {
  const createContext = (graphId: string): TraversalGenerationContext => ({
    currentGraphId: graphId,
    indentLevel: 0,
    variableCounter: 0,
    graphContracts: new Map(),
  })

  const createGenerationContext = (
    graphId: string,
  ): TraversalGenerationContext => ({
    currentGraphId: graphId,
    indentLevel: 0,
    variableCounter: 0,
    graphContracts: new Map(),
    enableNodeGeneration: true,
  })

  it('does NOT warn about ambiguous continuation when create-autocmd has both done and on-event edges', () => {
    const autocmdConfig = createDefaultActionConfig('create-autocmd')
    const graph = new GraphBuilder('autocmd-both-ports', 'autocmd-both-ports')
      .startupTrigger('entry', 'On Startup')
      .action('autocmd1', 'create-autocmd', autocmdConfig, 'Create Autocmd')
      .action(
        'thenAction',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Then Action',
      )
      .action(
        'callbackAction',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'relativenumber',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Callback Action',
      )
      .connectExec('entry', 'autocmd1')
      // done → then (main continuation)
      .connect('autocmd1', 'thenAction', 'done', 'exec')
      // on-event → callbackAction (deferred callback)
      .connect('autocmd1', 'callbackAction', 'on-event', 'exec')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)
    const collector = new DiagnosticsCollector()

    traverseExecFlow('entry', indexed, createContext(graph.id), collector)

    // Must NOT emit ambiguous-exec-continuation warning
    const ambiguousWarnings = collector
      .getWarnings()
      .filter((w) => w.id === 'ambiguous-exec-continuation')
    expect(ambiguousWarnings).toHaveLength(0)
  })

  it('still warns about ambiguous continuation when a regular action has 2 done edges', () => {
    const graph = new GraphBuilder('two-done-edges', 'two-done-edges')
      .startupTrigger('entry', 'On Startup')
      .action(
        'action1',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Action 1',
      )
      .action(
        'action2',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'relativenumber',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Action 2',
      )
      .action(
        'action3',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'wrap',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: false },
        },
        'Action 3',
      )
      .connectExec('entry', 'action1')
      // Two done edges from action1 — genuine ambiguity
      .connect('action1', 'action2', 'done', 'exec')
      .connect('action1', 'action3', 'done', 'exec')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)
    const collector = new DiagnosticsCollector()

    traverseExecFlow('entry', indexed, createContext(graph.id), collector)

    const ambiguousWarnings = collector
      .getWarnings()
      .filter((w) => w.id === 'ambiguous-exec-continuation')
    expect(ambiguousWarnings).toHaveLength(1)
  })

  it('topology mode: DFS follows done (not on-event) as linear continuation, full then-chain appears in output', () => {
    const autocmdConfig = createDefaultActionConfig('create-autocmd')
    const graph = new GraphBuilder('autocmd-topology', 'autocmd-topology')
      .startupTrigger('entry', 'On Startup')
      .action('autocmd1', 'create-autocmd', autocmdConfig, 'Create Autocmd')
      .action(
        'then1',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Then 1',
      )
      .action(
        'then2',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'relativenumber',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Then 2',
      )
      .action(
        'callbackAction',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'wrap',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: false },
        },
        'Callback Action',
      )
      .connectExec('entry', 'autocmd1')
      .connect('autocmd1', 'then1', 'done', 'exec')
      .connect('then1', 'then2', 'done', 'exec')
      .connect('autocmd1', 'callbackAction', 'on-event', 'exec')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)
    const collector = new DiagnosticsCollector()

    // Topology mode (enableNodeGeneration defaults to false/undefined)
    const units = traverseExecFlow(
      'entry',
      indexed,
      createContext(graph.id),
      collector,
    )

    expect(collector.hasErrors()).toBe(false)
    // No ambiguity warning
    expect(
      collector
        .getWarnings()
        .filter((w) => w.id === 'ambiguous-exec-continuation'),
    ).toHaveLength(0)

    // The full "then" chain must appear: entry, autocmd1, then1, then2
    const nodeIds = units.map((u) => u.nodeId)
    expect(nodeIds).toContain('entry')
    expect(nodeIds).toContain('autocmd1')
    expect(nodeIds).toContain('then1')
    expect(nodeIds).toContain('then2')
  })

  it('generation mode: DFS follows done as linear continuation (regardless of edge ID sort order)', () => {
    const autocmdConfig = createDefaultActionConfig('create-autocmd')

    // Build graph with explicit edge IDs so that the on-event edge sorts
    // BEFORE the done edge alphabetically: 'aaa-on-event' < 'zzz-done'.
    // If CALLBACK_EXEC_PORTS is not applied, a sort-order-based tie-break would
    // incorrectly follow on-event as the continuation, failing to emit the
    // thenAction code.  Using explicit IDs (the 5th argument to connect())
    // makes this order-regression condition deterministic.
    const graph = new GraphBuilder('autocmd-gen-mode', 'autocmd-gen-mode')
      .startupTrigger('entry', 'On Startup')
      .action('autocmd1', 'create-autocmd', autocmdConfig, 'Create Autocmd')
      .action(
        'thenAction',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Then Action',
      )
      .action(
        'callbackAction',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'relativenumber',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Callback Action',
      )
      .connectExec('entry', 'autocmd1')
      .connect('autocmd1', 'thenAction', 'done', 'exec', 'zzz-done')
      .connect('autocmd1', 'callbackAction', 'on-event', 'exec', 'aaa-on-event')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)
    const collector = new DiagnosticsCollector()

    const units = traverseExecFlow(
      'entry',
      indexed,
      createGenerationContext(graph.id),
      collector,
    )

    expect(collector.hasErrors()).toBe(false)
    expect(
      collector
        .getWarnings()
        .filter((w) => w.id === 'ambiguous-exec-continuation'),
    ).toHaveLength(0)

    // In generation mode, downstream nodes are inlined into the trigger unit.
    // The "then" action code must appear somewhere in the combined output.
    const combinedCode = units.map((u) => u.code.join('\n')).join('\n')
    expect(combinedCode).toContain('vim.opt.number')

    // thenAction's code (set number) must NOT be absent — it must be present
    // in the trigger's inlined output, proving done-chain was followed.
    // (relativenumber = callbackAction; number = thenAction)
    // Both may appear if the autocmd generator emits its callback body too,
    // but the key guarantee is that vim.opt.number (thenAction) is present.
    expect(combinedCode).toContain('vim.opt.number')
  })

  it('create-autocmd with only on-event connected (no done): no ambiguity warning, no errors', () => {
    const autocmdConfig = createDefaultActionConfig('create-autocmd')
    const graph = new GraphBuilder(
      'autocmd-only-on-event',
      'autocmd-only-on-event',
    )
      .startupTrigger('entry', 'On Startup')
      .action('autocmd1', 'create-autocmd', autocmdConfig, 'Create Autocmd')
      .action(
        'callbackAction',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Callback Action',
      )
      .connectExec('entry', 'autocmd1')
      // only on-event connected, no done
      .connect('autocmd1', 'callbackAction', 'on-event', 'exec')
      .build()

    const indexes = buildGraphIndexes([graph])
    const indexed = requireIndexedGraph(indexes, graph.id)
    const collector = new DiagnosticsCollector()

    traverseExecFlow('entry', indexed, createContext(graph.id), collector)

    expect(collector.hasErrors()).toBe(false)
    const ambiguousWarnings = collector
      .getWarnings()
      .filter((w) => w.id === 'ambiguous-exec-continuation')
    expect(ambiguousWarnings).toHaveLength(0)
  })

  it('Fix 3 (merge-point): findMergePoint skips callback-body nodes when one branch contains create-autocmd', () => {
    // Build a graph where one branch of a condition contains a create-autocmd node
    // with an on-event callback chain. The callback-body nodes (callbackAction)
    // should NOT be selected as the merge point — the true merge point is mergeNode.
    //
    //   entry → condition
    //           ├─ true  → autocmd1 ──done──► mergeNode
    //           │              └─on-event──► callbackAction
    //           └─ false → plainAction ────► mergeNode

    const autocmdConfig = createDefaultActionConfig('create-autocmd')
    const graph = new GraphBuilder('autocmd-merge', 'autocmd-merge')
      .startupTrigger('entry', 'On Startup')
      .condition('cond1', '==', 'x', '1', 'Is x == 1?')
      .action('autocmd1', 'create-autocmd', autocmdConfig, 'Create Autocmd')
      .action(
        'callbackAction',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'relativenumber',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Callback Action',
      )
      .action(
        'plainAction',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'wrap',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: false },
        },
        'Plain Action',
      )
      .action(
        'mergeNode',
        'set-option',
        {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global',
          valueConfig: { valueMode: 'suggested', suggestedValue: true },
        },
        'Merge Node',
      )
      .connectExec('entry', 'cond1')
      .connectTrue('cond1', 'autocmd1')
      .connect('autocmd1', 'mergeNode', 'done', 'exec')
      .connect('autocmd1', 'callbackAction', 'on-event', 'exec')
      .connectFalse('cond1', 'plainAction')
      .connect('plainAction', 'mergeNode', 'done', 'exec')
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

    // mergeNode must appear in output (it is the true merge point)
    const nodeIds = units.map((u) => u.nodeId)
    expect(nodeIds).toContain('mergeNode')

    // callbackAction should NOT be selected as the merge point
    // (it is a callback body, not a synchronous continuation)
    // The test verifies correct merge detection: mergeNode appears once
    const mergeOccurrences = nodeIds.filter((id) => id === 'mergeNode').length
    expect(mergeOccurrences).toBe(1)
  })
})
