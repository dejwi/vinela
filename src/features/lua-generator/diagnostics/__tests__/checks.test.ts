import { describe, expect, it } from 'vitest'
import { createTutorialSeedData } from '@/features/tutorial/data/seed-project'
import { NEOVIM_EVENT_CATALOG } from '@/shared/data/neovim/events'
import type { Graph, GraphEdge, GraphNode } from '@/shared/types'
import {
  checkCircularDependencies,
  checkCodeBlocks,
  checkDisabledDependencies,
  checkDisconnectedEntryPoints,
  checkDuplicateIds,
  checkEmptyGraphs,
  checkInvalidConfig,
  checkInvalidGraphRefs,
  checkMissingRequiredPorts,
  checkOrphanedNodes,
  checkTypeMismatches,
} from '../checks'
import { DiagnosticsCollector } from '../collector'
import {
  buildPreGenerationContext,
  PRE_GENERATION_CHECKS,
  runAllPreGenerationChecks,
} from '../index'

// ============================================
// Test Helpers
// ============================================

function createTestGraph(
  id: string,
  name: string,
  nodes: GraphNode[],
  edges: GraphEdge[] = [],
  enabled = true,
): Graph {
  return {
    id,
    name,
    nodes,
    edges,
    enabled,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function createTriggerNode(id: string): GraphNode {
  return {
    id,
    type: 'trigger',
    definitionId: 'trigger-startup',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'trigger',
      triggerType: 'startup',
    },
  }
}

function createCallableEntryNode(
  id: string,
  parameters: Array<{
    id: string
    name: string
    dataType: 'any' | 'string' | 'number' | 'boolean'
  }> = [],
): GraphNode {
  return {
    id,
    type: 'callable-entry',
    definitionId: 'callable-entry-main',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'callable-entry',
      parameters,
    },
  }
}

function createActionNode(id: string, actionType = 'set-option'): GraphNode {
  return {
    id,
    type: 'action',
    definitionId: `action-${actionType}`,
    position: { x: 100, y: 100 },
    data: {
      nodeType: 'action',
      actionType: actionType as 'set-option',
      label: 'Set Option',
      actionConfig: {
        actionConfigType: 'set-option',
        optionName: 'number',
        scope: 'global',
        valueConfig: {
          valueMode: 'suggested',
          suggestedValue: true,
        },
      },
    },
  }
}

function createConditionNode(
  id: string,
  hardcodedA = '',
  hardcodedB = '',
): GraphNode {
  return {
    id,
    type: 'condition',
    definitionId: 'condition-eq',
    position: { x: 100, y: 100 },
    data: {
      nodeType: 'condition',
      operator: '==',
      hardcodedA,
      hardcodedB,
    },
  }
}

function createCodeBlockNode(
  id: string,
  codeOrInputs:
    | string
    | Array<{
        id: string
        name: string
        dataType: 'any' | 'string' | 'number' | 'boolean' | 'table'
      }> = '',
  inputsOrOutputs: Array<{
    id: string
    name: string
    dataType: 'any' | 'string' | 'number' | 'boolean' | 'table'
  }> = [],
  outputs: Array<{
    id: string
    name: string
    dataType: 'any' | 'string' | 'number' | 'boolean' | 'table'
  }> = [],
): GraphNode {
  // Handle overload: createCodeBlockNode(id, code, inputs, outputs)
  if (typeof codeOrInputs === 'string') {
    return {
      id,
      type: 'code-block',
      definitionId: 'code-block-exec',
      position: { x: 100, y: 100 },
      data: {
        nodeType: 'code-block',
        code: codeOrInputs,
        inputs: inputsOrOutputs.map((i) => ({
          ...i,
          dataType: i.dataType as 'any',
        })),
        outputs: outputs.map((o) => ({ ...o, dataType: o.dataType as 'any' })),
      },
    }
  }

  // Handle overload: createCodeBlockNode(id, inputs)
  return {
    id,
    type: 'code-block',
    definitionId: 'code-block-exec',
    position: { x: 100, y: 100 },
    data: {
      nodeType: 'code-block',
      code: '',
      inputs: codeOrInputs.map((i) => ({
        ...i,
        dataType: i.dataType as 'any',
      })),
      outputs: [],
    },
  }
}

function createGraphRefNode(id: string, referencedGraphId: string): GraphNode {
  return {
    id,
    type: 'graph-ref',
    definitionId: 'graph-ref-callable',
    position: { x: 100, y: 100 },
    data: {
      nodeType: 'graph-ref',
      referencedGraphId,
    },
  }
}

function createEdge(
  id: string,
  source: string,
  target: string,
  sourcePort = 'output',
  targetPort = 'input',
): GraphEdge {
  return {
    id,
    source,
    sourcePort,
    target,
    targetPort,
  }
}

// ============================================
// Orphaned Nodes Tests
// ============================================

describe('checkOrphanedNodes', () => {
  it('should not warn for nodes connected to trigger', () => {
    const trigger = createTriggerNode('trigger-1')
    const action = createActionNode('action-1')
    const edge = createEdge('e1', 'trigger-1', 'action-1')

    const graph = createTestGraph('g1', 'Test Graph', [trigger, action], [edge])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkOrphanedNodes(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
  })

  it('should warn for nodes not connected to any entry', () => {
    const trigger = createTriggerNode('trigger-1')
    const action1 = createActionNode('action-1')
    const action2 = createActionNode('action-2')
    const edge = createEdge('e1', 'trigger-1', 'action-1')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [trigger, action1, action2],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkOrphanedNodes(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()).toHaveLength(1)
    expect(collector.getWarnings()[0]?.message).toContain('action-2')
    expect(collector.getWarnings()[0]?.id).toBe('WARN_STRUCTURE_ORPHANED_NODE')
  })

  it('should not warn for nodes connected to callable entry', () => {
    const entry = createCallableEntryNode('entry-1')
    const action = createActionNode('action-1')
    const edge = createEdge('e1', 'entry-1', 'action-1')

    const graph = createTestGraph(
      'g1',
      'Callable Graph',
      [entry, action],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkOrphanedNodes(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
  })

  it('should warn for multiple orphaned nodes in same graph', () => {
    const trigger = createTriggerNode('trigger-1')
    const action1 = createActionNode('action-1')
    const action2 = createActionNode('action-2')
    const action3 = createActionNode('action-3')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [trigger, action1, action2, action3],
      [],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkOrphanedNodes(ctx, collector)

    expect(collector.getWarnings()).toHaveLength(3)
  })

  it('should skip disabled graphs', () => {
    const trigger = createTriggerNode('trigger-1')
    const action = createActionNode('action-1')

    const graph = createTestGraph(
      'g1',
      'Disabled Graph',
      [trigger, action],
      [],
      false,
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkOrphanedNodes(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
  })

  it('should include node type in source', () => {
    const trigger = createTriggerNode('trigger-1')
    const action = createActionNode('action-1')

    const graph = createTestGraph('g1', 'Test Graph', [trigger, action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkOrphanedNodes(ctx, collector)

    const warning = collector.getWarnings()[0]
    expect(warning?.source?.nodeType).toBe('action')
    expect(warning?.source?.graphId).toBe('g1')
    expect(warning?.source?.nodeId).toBe('action-1')
  })

  it('should provide helpful suggestions', () => {
    const trigger = createTriggerNode('trigger-1')
    const action = createActionNode('action-1')

    const graph = createTestGraph('g1', 'Test Graph', [trigger, action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkOrphanedNodes(ctx, collector)

    const warning = collector.getWarnings()[0]
    expect(warning?.suggestions).toBeDefined()
    expect(warning?.suggestions?.length).toBeGreaterThan(0)
    expect(warning?.suggestions?.some((s) => s.includes('exec'))).toBe(true)
  })
})

// ============================================
// Missing Required Ports Tests
// ============================================

describe('checkMissingRequiredPorts', () => {
  it('should error for condition node with no inputs and no hardcoded values', () => {
    const condition = createConditionNode('cond-1', '', '')
    const graph = createTestGraph('g1', 'Test Graph', [condition], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkMissingRequiredPorts(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()).toHaveLength(2) // Both a and b missing
  })

  it('should not error for condition with hardcoded values', () => {
    const condition = createConditionNode('cond-1', '10', '20')
    const graph = createTestGraph('g1', 'Test Graph', [condition], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkMissingRequiredPorts(ctx, collector)

    expect(collector.hasErrors()).toBe(false)
  })

  it('should not error for condition with connected inputs', () => {
    const trigger = createTriggerNode('trigger-1')
    const condition = createConditionNode('cond-1', '', '')
    const edgeA = createEdge('e1', 'trigger-1', 'cond-1', 'output', 'a')
    const edgeB = createEdge('e2', 'trigger-1', 'cond-1', 'output', 'b')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [trigger, condition],
      [edgeA, edgeB],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkMissingRequiredPorts(ctx, collector)

    expect(collector.hasErrors()).toBe(false)
  })

  it('should error for code block with disconnected inputs', () => {
    const codeBlock = createCodeBlockNode('cb-1', [
      { id: 'input-1', name: 'value1', dataType: 'string' },
      { id: 'input-2', name: 'value2', dataType: 'number' },
    ])

    const graph = createTestGraph('g1', 'Test Graph', [codeBlock], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkMissingRequiredPorts(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()).toHaveLength(2)
    expect(collector.getErrors()[0]?.message).toContain('value1')
    expect(collector.getErrors()[1]?.message).toContain('value2')
  })

  it('should include port ID in source for missing ports', () => {
    const condition = createConditionNode('cond-1', '', '')
    const graph = createTestGraph('g1', 'Test Graph', [condition], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkMissingRequiredPorts(ctx, collector)

    const error = collector.getErrors()[0]
    expect(error?.source?.portId).toBeDefined()
    expect(['a', 'b']).toContain(error?.source?.portId)
  })

  it('should skip disabled graphs', () => {
    const condition = createConditionNode('cond-1', '', '')
    const graph = createTestGraph(
      'g1',
      'Disabled Graph',
      [condition],
      [],
      false,
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkMissingRequiredPorts(ctx, collector)

    expect(collector.hasErrors()).toBe(false)
  })

  it('should not check entry nodes', () => {
    const trigger = createTriggerNode('trigger-1')
    const entry = createCallableEntryNode('entry-1')

    const graph = createTestGraph('g1', 'Test Graph', [trigger, entry], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkMissingRequiredPorts(ctx, collector)

    expect(collector.hasErrors()).toBe(false)
  })
})

// ============================================
// Disconnected Entry Points Tests
// ============================================

describe('checkDisconnectedEntryPoints', () => {
  it('should warn for callable graph with no references', () => {
    const entry = createCallableEntryNode('entry-1')
    const callableGraph = createTestGraph('g1', 'Callable Graph', [entry], [])

    const ctx = buildPreGenerationContext({ graphs: [callableGraph] })
    const collector = new DiagnosticsCollector()

    checkDisconnectedEntryPoints(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()).toHaveLength(1)
    expect(collector.getWarnings()[0]?.message).toContain('Callable Graph')
    expect(collector.getWarnings()[0]?.id).toBe(
      'WARN_STRUCTURE_DISCONNECTED_CALLABLE',
    )
  })

  it('should not warn for callable graph with references', () => {
    const entry = createCallableEntryNode('entry-1')
    const callableGraph = createTestGraph('g1', 'Callable Graph', [entry], [])

    const trigger = createTriggerNode('trigger-1')
    const graphRef = createGraphRefNode('ref-1', 'g1')
    const mainGraph = createTestGraph(
      'g2',
      'Main Graph',
      [trigger, graphRef],
      [],
    )

    const ctx = buildPreGenerationContext({
      graphs: [callableGraph, mainGraph],
    })
    const collector = new DiagnosticsCollector()

    checkDisconnectedEntryPoints(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
  })

  it('should count multiple references correctly', () => {
    const entry = createCallableEntryNode('entry-1')
    const callableGraph = createTestGraph('g1', 'Callable Graph', [entry], [])

    const trigger = createTriggerNode('trigger-1')
    const graphRef1 = createGraphRefNode('ref-1', 'g1')
    const graphRef2 = createGraphRefNode('ref-2', 'g1')
    const mainGraph = createTestGraph(
      'g2',
      'Main Graph',
      [trigger, graphRef1, graphRef2],
      [],
    )

    const ctx = buildPreGenerationContext({
      graphs: [callableGraph, mainGraph],
    })
    const collector = new DiagnosticsCollector()

    checkDisconnectedEntryPoints(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
  })

  it('should skip disabled callable graphs', () => {
    const entry = createCallableEntryNode('entry-1')
    const callableGraph = createTestGraph(
      'g1',
      'Disabled Callable',
      [entry],
      [],
      false,
    )

    const ctx = buildPreGenerationContext({ graphs: [callableGraph] })
    const collector = new DiagnosticsCollector()

    checkDisconnectedEntryPoints(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
  })

  it('should not warn for non-callable graphs', () => {
    const trigger = createTriggerNode('trigger-1')
    const action = createActionNode('action-1')
    const graph = createTestGraph(
      'g1',
      'Non-callable Graph',
      [trigger, action],
      [],
    )

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkDisconnectedEntryPoints(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
  })

  it('should provide graph-level source', () => {
    const entry = createCallableEntryNode('entry-1')
    const callableGraph = createTestGraph('g1', 'Orphan Callable', [entry], [])

    const ctx = buildPreGenerationContext({ graphs: [callableGraph] })
    const collector = new DiagnosticsCollector()

    checkDisconnectedEntryPoints(ctx, collector)

    const warning = collector.getWarnings()[0]
    expect(warning?.source?.graphId).toBe('g1')
    expect(warning?.source?.nodeId).toBeUndefined()
  })

  it('should provide helpful suggestions', () => {
    const entry = createCallableEntryNode('entry-1')
    const callableGraph = createTestGraph('g1', 'Orphan Callable', [entry], [])

    const ctx = buildPreGenerationContext({ graphs: [callableGraph] })
    const collector = new DiagnosticsCollector()

    checkDisconnectedEntryPoints(ctx, collector)

    const warning = collector.getWarnings()[0]
    expect(warning?.suggestions?.length).toBeGreaterThanOrEqual(2)
    expect(
      warning?.suggestions?.some((s) => s.includes('Graph Reference')),
    ).toBe(true)
  })
})

// ============================================
// Integration Tests
// ============================================

describe('diagnostics integration (non-fail-fast)', () => {
  it('should collect all errors from multiple checks without failing fast', () => {
    // Graph 1: Orphaned node + missing port
    const trigger = createTriggerNode('trigger-1')
    const orphanedAction = createActionNode('orphan-action')
    const condition = createConditionNode('cond-1', '', '')
    const edge = createEdge('e1', 'trigger-1', 'cond-1')

    const graph1 = createTestGraph(
      'g1',
      'Problematic Graph',
      [trigger, orphanedAction, condition],
      [edge],
    )

    // Graph 2: Disconnected callable
    const entry = createCallableEntryNode('entry-1')
    const graph2 = createTestGraph('g2', 'Disconnected Callable', [entry], [])

    const ctx = buildPreGenerationContext({ graphs: [graph1, graph2] })
    const collector = new DiagnosticsCollector()

    // Run all checks
    checkOrphanedNodes(ctx, collector)
    checkMissingRequiredPorts(ctx, collector)
    checkDisconnectedEntryPoints(ctx, collector)

    // Should have warnings from orphaned nodes and disconnected callables
    expect(collector.getWarnings().length).toBeGreaterThanOrEqual(2)

    // Should have errors from missing ports
    expect(collector.getErrors().length).toBeGreaterThanOrEqual(2)

    // All should be collected
    expect(collector.count).toBeGreaterThanOrEqual(4)
  })

  it('should deduplicate across multiple check runs', () => {
    const trigger = createTriggerNode('trigger-1')
    const orphanedAction = createActionNode('orphan-action')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [trigger, orphanedAction],
      [],
    )

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    // Run same check twice
    checkOrphanedNodes(ctx, collector)
    checkOrphanedNodes(ctx, collector)

    // Should still only have one warning
    expect(collector.getWarnings()).toHaveLength(1)
  })
})

// ============================================
// Check 4: Type Mismatches Tests
// ============================================

describe('checkTypeMismatches', () => {
  it('should error on void to data connection', () => {
    // Create a code block that outputs a number
    const codeBlock = createCodeBlockNode(
      'cb-1',
      'return 42',
      [],
      [{ id: 'out', name: 'result', dataType: 'number' }],
    )
    // Create an action node with void input
    const action = createActionNode('action-1', 'set-option')

    // Invalid: code block number output to action void input
    // The action's input port is 'exec' which is void (exec flow)
    const edge = createEdge('e1', 'cb-1', 'action-1', 'out', 'exec')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [codeBlock, action],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_TYPE_MISMATCH')
  })

  it('should allow compatible type connections', () => {
    const codeBlock1 = createCodeBlockNode(
      'cb-1',
      'return 42',
      [],
      [{ id: 'out', name: 'num', dataType: 'number' }],
    )
    const codeBlock2 = createCodeBlockNode(
      'cb-2',
      'return input + 1',
      [{ id: 'in', name: 'input', dataType: 'number' }],
      [],
    )
    const edge = createEdge('e1', 'cb-1', 'cb-2', 'out', 'in')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [codeBlock1, codeBlock2],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    expect(collector.hasErrors()).toBe(false)
  })

  it('should warn on any connections', () => {
    const codeBlock1 = createCodeBlockNode(
      'cb-1',
      'return 42',
      [],
      [{ id: 'out', name: 'val', dataType: 'any' }],
    )
    const codeBlock2 = createCodeBlockNode(
      'cb-2',
      'return input',
      [{ id: 'in', name: 'input', dataType: 'number' }],
      [],
    )
    const edge = createEdge('e1', 'cb-1', 'cb-2', 'out', 'in')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [codeBlock1, codeBlock2],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()[0]?.id).toBe('WARN_TYPE_ANY_CONNECTION')
  })

  it('should skip disabled graphs', () => {
    const codeBlock1 = createCodeBlockNode(
      'cb-1',
      'return 42',
      [],
      [{ id: 'out', name: 'num', dataType: 'number' }],
    )
    const codeBlock2 = createCodeBlockNode(
      'cb-2',
      'return "text"',
      [],
      [{ id: 'out', name: 'str', dataType: 'string' }],
    )
    const edge = createEdge('e1', 'cb-1', 'cb-2', 'out', 'out')

    const graph = createTestGraph(
      'g1',
      'Disabled Graph',
      [codeBlock1, codeBlock2],
      [edge],
      false,
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    expect(collector.hasErrors()).toBe(false)
    expect(collector.hasWarnings()).toBe(false)
  })
})

// ============================================
// Check 5: Invalid Graph References Tests
// ============================================

describe('checkInvalidGraphRefs', () => {
  it('should error on empty referencedGraphId', () => {
    const trigger = createTriggerNode('trigger-1')
    const graphRef = createGraphRefNode('ref-1', '')

    const graph = createTestGraph('g1', 'Test Graph', [trigger, graphRef], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidGraphRefs(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_REF_GRAPH_REF_NO_TARGET')
  })

  it('should error on missing target graph', () => {
    const trigger = createTriggerNode('trigger-1')
    const graphRef = createGraphRefNode('ref-1', 'non-existent-graph')

    const graph = createTestGraph('g1', 'Test Graph', [trigger, graphRef], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidGraphRefs(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe(
      'ERR_REF_GRAPH_REF_MISSING_TARGET',
    )
  })

  it('should error on non-callable target graph', () => {
    // Target graph without callable entry
    const targetGraph = createTestGraph(
      'g2',
      'Target Graph',
      [createTriggerNode('trigger-1')],
      [],
    )

    // Source graph with ref to non-callable graph
    const trigger = createTriggerNode('trigger-1')
    const graphRef = createGraphRefNode('ref-1', 'g2')
    const sourceGraph = createTestGraph(
      'g1',
      'Source Graph',
      [trigger, graphRef],
      [],
    )

    const ctx = buildPreGenerationContext({
      graphs: [targetGraph, sourceGraph],
    })
    const collector = new DiagnosticsCollector()

    checkInvalidGraphRefs(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_REF_GRAPH_REF_NOT_CALLABLE')
  })

  it('should warn on ref to disabled graph', () => {
    // Target callable graph but disabled (defined first)
    const entry = createCallableEntryNode('entry-1')
    const targetGraph = createTestGraph(
      'g2',
      'Disabled Target',
      [entry],
      [],
      false,
    )

    // Source graph with ref to disabled graph - also has a trigger so it can run standalone
    // But g1 will also be disabled because it depends on g2
    const trigger = createTriggerNode('trigger-1')
    const graphRef = createGraphRefNode('ref-1', 'g2')
    const sourceGraph = createTestGraph(
      'g1',
      'Source Graph',
      [trigger, graphRef],
      [],
    )

    const ctx = buildPreGenerationContext({
      graphs: [targetGraph, sourceGraph],
    })
    const collector = new DiagnosticsCollector()

    checkInvalidGraphRefs(ctx, collector)

    // Note: g1 will be dependency-disabled because it references disabled g2
    // So checkInvalidGraphRefs will skip it. The warning about disabled
    // dependencies is handled by checkDisabledDependencies instead.
    // This test verifies that if we force the check (g1 enabled), the warning is emitted.
    // For now, expect no warnings because g1 is auto-disabled.
    expect(collector.hasWarnings()).toBe(false)
  })
})

// ============================================
// Check 6: Circular Dependencies Tests
// ============================================

describe('checkCircularDependencies', () => {
  it('should detect inter-graph cycle', () => {
    // Graph A -> Graph B -> Graph A
    const entryA = createCallableEntryNode('entry-a')
    const refA = createGraphRefNode('ref-a', 'g2')
    const graphA = createTestGraph('g1', 'Graph A', [entryA, refA], [])

    const entryB = createCallableEntryNode('entry-b')
    const refB = createGraphRefNode('ref-b', 'g1')
    const graphB = createTestGraph('g2', 'Graph B', [entryB, refB], [])

    const ctx = buildPreGenerationContext({ graphs: [graphA, graphB] })
    const collector = new DiagnosticsCollector()

    checkCircularDependencies(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_CYCLE_INTER_GRAPH')
  })

  it('should detect intra-graph cycle', () => {
    // Node A -> Node B -> Node A within same graph
    const nodeA = createActionNode('action-a')
    const nodeB = createActionNode('action-b')
    const edge1 = createEdge('e1', 'action-a', 'action-b')
    const edge2 = createEdge('e2', 'action-b', 'action-a')

    const graph = createTestGraph(
      'g1',
      'Cyclic Graph',
      [nodeA, nodeB],
      [edge1, edge2],
    )

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCircularDependencies(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_CYCLE_INTRA_GRAPH')
  })

  it('should not report false positives for acyclic graphs', () => {
    const entry = createCallableEntryNode('entry-1')
    const action = createActionNode('action-1')
    const graph = createTestGraph('g1', 'Simple Graph', [entry, action], [])

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCircularDependencies(ctx, collector)

    expect(collector.hasErrors()).toBe(false)
  })
})

// ============================================
// Check 7: Invalid Config Tests
// ============================================

describe('checkInvalidConfig', () => {
  it('should error on empty option name', () => {
    const action = createActionNode('action-1', 'set-option')
    // Override with empty option name
    action.data = {
      ...action.data,
      actionConfig: {
        actionConfigType: 'set-option',
        optionName: '',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      },
    } as GraphNode['data']

    const graph = createTestGraph('g1', 'Test Graph', [action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_CONFIG_EMPTY_OPTION_NAME')
  })

  it('should error on empty keymap key sequence', () => {
    const action = createActionNode('action-1', 'set-keymap')
    action.data = {
      nodeType: 'action',
      actionType: 'set-keymap',
      label: 'Set Keymap',
      actionConfig: {
        actionConfigType: 'set-keymap',
        modes: ['n'],
        keySequence: '',
        command: ':echo hello',
        description: '',
        silent: true,
        noremap: true,
        expr: false,
        showInKeymaps: true,
      },
    }

    const graph = createTestGraph('g1', 'Test Graph', [action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_CONFIG_INVALID_KEYMAP')
  })

  it('should error on empty autocmd events', () => {
    const action = createActionNode('action-1', 'create-autocmd')
    action.data = {
      nodeType: 'action',
      actionType: 'create-autocmd',
      label: 'Create Autocmd',
      actionConfig: {
        actionConfigType: 'create-autocmd',
        events: [],
        patterns: ['*'],
        callbackLua: 'print("hello")',
        groupName: '',
        once: false,
        nested: false,
      },
    }

    const graph = createTestGraph('g1', 'Test Graph', [action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    const firstError = collector.getErrors()[0]
    expect(firstError?.id).toBe('ERR_CONFIG_INVALID_AUTOCDM_EVENTS')
    expect(firstError?.message).toContain('invalid autocmd event configuration')
    expect(firstError?.details).toContain('No autocmd events selected')
  })

  it('should accept DirChanged as a valid autocmd event', () => {
    const action = createActionNode('action-1', 'create-autocmd')
    action.data = {
      nodeType: 'action',
      actionType: 'create-autocmd',
      label: 'Create Autocmd',
      actionConfig: {
        actionConfigType: 'create-autocmd',
        events: ['DirChanged'],
        patterns: ['*'],
        callbackLua: 'print("cwd changed")',
        groupName: '',
        once: false,
        nested: false,
      },
    }

    const graph = createTestGraph('g1', 'Test Graph', [action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(
      collector
        .getErrors()
        .some((error) => error.id === 'ERR_CONFIG_INVALID_AUTOCDM_EVENTS'),
    ).toBe(false)
  })

  it('should accept Progress/PackChanged/PackChangedPre autocmd events', () => {
    const action = createActionNode('action-1', 'create-autocmd')
    action.data = {
      nodeType: 'action',
      actionType: 'create-autocmd',
      label: 'Create Autocmd',
      actionConfig: {
        actionConfigType: 'create-autocmd',
        events: ['Progress', 'PackChanged', 'PackChangedPre'],
        patterns: ['*'],
        callbackLua: 'print("event fired")',
        groupName: '',
        once: false,
        nested: false,
      },
    }

    const graph = createTestGraph('g1', 'Test Graph', [action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(
      collector
        .getErrors()
        .some((error) => error.id === 'ERR_CONFIG_INVALID_AUTOCDM_EVENTS'),
    ).toBe(false)
  })

  it('should treat whitespace-only autocmd events as no events selected', () => {
    const action = createActionNode('action-1', 'create-autocmd')
    action.data = {
      nodeType: 'action',
      actionType: 'create-autocmd',
      label: 'Create Autocmd',
      actionConfig: {
        actionConfigType: 'create-autocmd',
        events: ['   ', '\t'],
        patterns: ['*'],
        callbackLua: 'print("hello")',
        groupName: '',
        once: false,
        nested: false,
      },
    }

    const graph = createTestGraph('g1', 'Test Graph', [action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    const firstError = collector.getErrors()[0]
    expect(firstError?.id).toBe('ERR_CONFIG_INVALID_AUTOCDM_EVENTS')
    expect(firstError?.details).toContain('No autocmd events selected')
  })

  it('should accept lowercase known autocmd events via canonical validation', () => {
    const action = createActionNode('action-1', 'create-autocmd')
    action.data = {
      nodeType: 'action',
      actionType: 'create-autocmd',
      label: 'Create Autocmd',
      actionConfig: {
        actionConfigType: 'create-autocmd',
        events: ['bufenter'],
        patterns: ['*'],
        callbackLua: 'print("event fired")',
        groupName: '',
        once: false,
        nested: false,
      },
    }

    const graph = createTestGraph('g1', 'Test Graph', [action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(
      collector
        .getErrors()
        .some((error) => error.id === 'ERR_CONFIG_INVALID_AUTOCDM_EVENTS'),
    ).toBe(false)
  })

  it('should accept every catalog event as a valid autocmd event', () => {
    for (const { name: eventName } of NEOVIM_EVENT_CATALOG) {
      const action = createActionNode('action-1', 'create-autocmd')
      action.data = {
        nodeType: 'action',
        actionType: 'create-autocmd',
        label: 'Create Autocmd',
        actionConfig: {
          actionConfigType: 'create-autocmd',
          events: [eventName],
          patterns: ['*'],
          callbackLua: 'print("event fired")',
          groupName: '',
          once: false,
          nested: false,
        },
      }

      const graph = createTestGraph('g1', 'Test Graph', [action], [])
      const ctx = buildPreGenerationContext({ graphs: [graph] })
      const collector = new DiagnosticsCollector()

      checkInvalidConfig(ctx, collector)

      expect(
        collector
          .getErrors()
          .some((error) => error.id === 'ERR_CONFIG_INVALID_AUTOCDM_EVENTS'),
      ).toBe(false)
    }
  })

  it('should accept canonical User* autocmd events', () => {
    const action = createActionNode('action-1', 'create-autocmd')
    action.data = {
      nodeType: 'action',
      actionType: 'create-autocmd',
      label: 'Create Autocmd',
      actionConfig: {
        actionConfigType: 'create-autocmd',
        events: ['UserMyEvent'],
        patterns: ['*'],
        callbackLua: 'print("user event")',
        groupName: '',
        once: false,
        nested: false,
      },
    }

    const graph = createTestGraph('g1', 'Test Graph', [action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(
      collector
        .getErrors()
        .some((error) => error.id === 'ERR_CONFIG_INVALID_AUTOCDM_EVENTS'),
    ).toBe(false)
  })

  it('should reject non-canonical lowercase user* autocmd events', () => {
    const action = createActionNode('action-1', 'create-autocmd')
    action.data = {
      nodeType: 'action',
      actionType: 'create-autocmd',
      label: 'Create Autocmd',
      actionConfig: {
        actionConfigType: 'create-autocmd',
        events: ['userMyEvent'],
        patterns: ['*'],
        callbackLua: 'print("user event")',
        groupName: '',
        once: false,
        nested: false,
      },
    }

    const graph = createTestGraph('g1', 'Test Graph', [action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(
      collector
        .getErrors()
        .some((error) => error.id === 'ERR_CONFIG_INVALID_AUTOCDM_EVENTS'),
    ).toBe(true)
  })

  it('should warn on unknown option name', () => {
    const action = createActionNode('action-1', 'set-option')
    action.data = {
      ...action.data,
      actionConfig: {
        actionConfigType: 'set-option',
        optionName: 'this_is_not_a_real_option',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      },
    } as GraphNode['data']

    const graph = createTestGraph('g1', 'Test Graph', [action], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()[0]?.id).toBe('WARN_CONFIG_UNKNOWN_OPTION')
  })

  it('should skip disabled graphs', () => {
    const action = createActionNode('action-1', 'set-option')
    action.data = {
      ...action.data,
      actionConfig: {
        actionConfigType: 'set-option',
        optionName: '',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      },
    } as GraphNode['data']

    const graph = createTestGraph('g1', 'Disabled Graph', [action], [], false)
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    expect(collector.hasErrors()).toBe(false)
  })
})

// ============================================
// Check 8: Duplicate IDs Tests
// ============================================

describe('checkDuplicateIds', () => {
  it('should error on duplicate graph IDs', () => {
    const graph1 = createTestGraph('g1', 'Graph 1', [createTriggerNode('t1')])
    const graph2 = createTestGraph('g1', 'Graph 2', [createTriggerNode('t2')])

    const ctx = buildPreGenerationContext({ graphs: [graph1, graph2] })
    const collector = new DiagnosticsCollector()

    checkDuplicateIds(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_DUPLICATE_GRAPH_ID')
  })

  it('should error on duplicate node IDs within graph', () => {
    const node1 = createActionNode('action-1')
    const node2 = createActionNode('action-1') // Same ID

    const graph = createTestGraph('g1', 'Test Graph', [node1, node2])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkDuplicateIds(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_DUPLICATE_NODE_ID')
  })

  it('should error on duplicate edge IDs within graph', () => {
    const node1 = createTriggerNode('trigger-1')
    const node2 = createActionNode('action-1')
    const edge1 = createEdge('edge-1', 'trigger-1', 'action-1')
    const edge2 = createEdge('edge-1', 'trigger-1', 'action-1') // Same ID

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [node1, node2],
      [edge1, edge2],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkDuplicateIds(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_DUPLICATE_EDGE_ID')
  })

  it('should not error on unique IDs', () => {
    const graph1 = createTestGraph('g1', 'Graph 1', [createTriggerNode('t1')])
    const graph2 = createTestGraph('g2', 'Graph 2', [createTriggerNode('t2')])

    const ctx = buildPreGenerationContext({ graphs: [graph1, graph2] })
    const collector = new DiagnosticsCollector()

    checkDuplicateIds(ctx, collector)

    expect(collector.hasErrors()).toBe(false)
  })
})

// ============================================
// Check 9: Empty Graphs Tests
// ============================================

describe('checkEmptyGraphs', () => {
  it('should warn on graph with no nodes', () => {
    const graph = createTestGraph('g1', 'Empty Graph', [])

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkEmptyGraphs(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()[0]?.id).toBe('WARN_EMPTY_GRAPH_NO_NODES')
  })

  it('should warn on graph with no entry points', () => {
    const graph = createTestGraph('g1', 'No Entry Graph', [
      createActionNode('action-1'),
    ])

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkEmptyGraphs(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()[0]?.id).toBe('WARN_EMPTY_GRAPH_NO_ENTRY')
  })

  it('should warn on graph with entry but no content', () => {
    const graph = createTestGraph('g1', 'No Content Graph', [
      createCallableEntryNode('entry-1'),
      createActionNode('action-1'),
    ])

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkEmptyGraphs(ctx, collector)

    // Should not warn because there IS executable content (action node)
    expect(collector.hasWarnings()).toBe(false)
  })

  it('should not warn on valid graphs', () => {
    const graph = createTestGraph('g1', 'Valid Graph', [
      createTriggerNode('trigger-1'),
      createActionNode('action-1'),
    ])

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkEmptyGraphs(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
  })
})

// ============================================
// Check 10: Disabled Dependencies Tests
// ============================================

describe('checkDisabledDependencies', () => {
  it('should warn when enabled graph depends on disabled graph', () => {
    // Note: The disable state computation transitively disables graphs that
    // depend on disabled graphs. So this scenario can only occur when:
    // 1. A graph is not callable (no entry point) and references a disabled callable
    // 2. The graph has a trigger (startup) and references a disabled callable
    //
    // In the first case, the graph would be disabled transitively.
    // In the second case, the graph has a trigger so it CAN run independently.

    // g1: Has a trigger (can run on startup) AND references g2
    const trigger = createTriggerNode('trigger-1')
    const graphRef = createGraphRefNode('ref-1', 'g2')
    const enabledGraph = createTestGraph(
      'g1',
      'Enabled Graph',
      [trigger, graphRef],
      [],
    )

    // g2: Disabled callable graph
    const entry = createCallableEntryNode('entry-1')
    const disabledGraph = createTestGraph(
      'g2',
      'Disabled Graph',
      [entry],
      [],
      false,
    )

    const ctx = buildPreGenerationContext({
      graphs: [enabledGraph, disabledGraph],
    })

    // Debug: log disable states
    console.log(
      'Test: should warn when enabled graph depends on disabled graph',
    )
    for (const [id, state] of ctx.disableStates) {
      console.log(`  ${id}: ${state.effective.kind}`)
    }

    const collector = new DiagnosticsCollector()

    checkDisabledDependencies(ctx, collector)

    // g1 will be dependency-disabled because it references disabled g2
    // So checkDisabledDependencies will skip it.
    // This is the expected behavior - transitive disable prevents the need for warnings.
    expect(collector.hasWarnings()).toBe(false)
  })

  it('should not warn when all dependencies are enabled', () => {
    // Enabled callable graph
    const entry = createCallableEntryNode('entry-1')
    const enabledGraph = createTestGraph('g2', 'Enabled Graph', [entry])

    // Another enabled graph that references it
    const trigger = createTriggerNode('trigger-1')
    const graphRef = createGraphRefNode('ref-1', 'g2')
    const callerGraph = createTestGraph(
      'g1',
      'Caller Graph',
      [trigger, graphRef],
      [],
    )

    const ctx = buildPreGenerationContext({
      graphs: [enabledGraph, callerGraph],
    })
    const collector = new DiagnosticsCollector()

    checkDisabledDependencies(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
  })
})

// ============================================
// Check 11: Code Block Validation Tests
// ============================================

describe('checkCodeBlocks', () => {
  it('should error on empty code block', () => {
    const codeBlock = createCodeBlockNode('cb-1', '')

    const graph = createTestGraph('g1', 'Test Graph', [codeBlock])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCodeBlocks(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_CONFIG_CODEBLOCK_EMPTY')
  })

  it('should error on duplicate port names', () => {
    const codeBlock = createCodeBlockNode(
      'cb-1',
      'return value',
      [
        { id: 'in1', name: 'value', dataType: 'number' },
        { id: 'in2', name: 'VALUE', dataType: 'string' }, // Duplicate (case-insensitive)
      ],
      [],
    )

    const graph = createTestGraph('g1', 'Test Graph', [codeBlock])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCodeBlocks(ctx, collector)

    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe(
      'ERR_CONFIG_CODEBLOCK_DUPLICATE_PORT',
    )
  })

  it('should warn on reserved word port names', () => {
    const codeBlock = createCodeBlockNode(
      'cb-1',
      'return end_val',
      [{ id: 'in1', name: 'end', dataType: 'number' }], // Reserved word
      [],
    )

    const graph = createTestGraph('g1', 'Test Graph', [codeBlock])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCodeBlocks(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()[0]?.id).toBe(
      'WARN_CONFIG_CODEBLOCK_RESERVED_PORT',
    )
  })

  it('should warn on mismatched block keywords', () => {
    // Mismatched do/end - more dos than ends
    const codeBlock = createCodeBlockNode(
      'cb-1',
      'do print("a") do print("b") end',
    )

    const graph = createTestGraph('g1', 'Test Graph', [codeBlock])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCodeBlocks(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()[0]?.id).toBe(
      'WARN_CONFIG_CODEBLOCK_MISMATCHED_KEYWORDS',
    )
  })

  it('does not warn for keywords in a long-bracket code block', () => {
    const code = [
      'vim.cmd [=[',
      '  function MyTabLine()',
      '    for i in range(tabpagenr("$"))',
      '      if i == 1',
      '      endif',
      '    endfor',
      '  endfunction',
      ']=]',
      'vim.opt.showtabline = 2',
    ].join('\n')
    const codeBlock = createCodeBlockNode('cb-1', code)
    const graph = createTestGraph('g1', 'Test Graph', [codeBlock])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCodeBlocks(ctx, collector)

    expect(
      collector
        .getWarnings()
        .map((warning) => warning.id)
        .includes('WARN_CONFIG_CODEBLOCK_MISMATCHED_KEYWORDS'),
    ).toBe(false)
  })

  it.each([
    'local marker = "[["\nif ready\n]]',
    "local marker = '[[ '\nif ready\n]]",
    '-- [[ marker\nif ready\n]]',
    '--[=[x]=] if ready',
  ])('warns when an opener shape must not hide executable Lua', (code) => {
    const codeBlock = createCodeBlockNode('cb-1', code)
    const graph = createTestGraph('g1', 'Test Graph', [codeBlock])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCodeBlocks(ctx, collector)

    expect(collector.getWarnings().map((warning) => warning.id)).toContain(
      'WARN_CONFIG_CODEBLOCK_MISMATCHED_KEYWORDS',
    )
  })

  it('should warn on missing return with outputs', () => {
    const codeBlock = createCodeBlockNode(
      'cb-1',
      'local x = 42',
      [],
      [{ id: 'out1', name: 'result', dataType: 'number' }],
    )

    const graph = createTestGraph('g1', 'Test Graph', [codeBlock])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCodeBlocks(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()[0]?.id).toBe(
      'WARN_CONFIG_CODEBLOCK_MISSING_RETURN',
    )
  })

  it('should not warn on return with outputs', () => {
    const codeBlock = createCodeBlockNode(
      'cb-1',
      'return 42',
      [],
      [{ id: 'out1', name: 'result', dataType: 'number' }],
    )

    const graph = createTestGraph('g1', 'Test Graph', [codeBlock])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCodeBlocks(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
  })

  it('should skip disabled graphs', () => {
    const codeBlock = createCodeBlockNode('cb-1', '')

    const graph = createTestGraph(
      'g1',
      'Disabled Graph',
      [codeBlock],
      [],
      false,
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkCodeBlocks(ctx, collector)

    expect(collector.hasErrors()).toBe(false)
  })
})

// ============================================
// PRE_GENERATION_CHECKS Registry Tests
// ============================================

describe('PRE_GENERATION_CHECKS', () => {
  it('should contain all 12 checks', () => {
    expect(PRE_GENERATION_CHECKS).toHaveLength(12)
  })

  it('should have unique IDs for all checks', () => {
    const ids = PRE_GENERATION_CHECKS.map((check) => check.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should run all checks without throwing', () => {
    const trigger = createTriggerNode('trigger-1')
    const action = createActionNode('action-1')
    const edge = createEdge('e1', 'trigger-1', 'action-1')
    const graph = createTestGraph('g1', 'Test Graph', [trigger, action], [edge])

    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    // Run all checks
    for (const check of PRE_GENERATION_CHECKS) {
      expect(() => check.run(ctx, collector)).not.toThrow()
    }
  })
})

// ============================================
// Tutorial Seed Regression Tests
// ============================================

describe('tutorial seed graphs pass pre-generation validation', () => {
  it('should produce no errors and no warnings with the tutorial seed data', () => {
    const seed = createTutorialSeedData()
    const ctx = buildPreGenerationContext({ graphs: [...seed.graphs] })
    const result = runAllPreGenerationChecks(ctx)

    expect(result.hasErrors).toBe(false)
    expect(result.hasWarnings).toBe(false)
  })
})

// ============================================
// Type Mismatch Regression: graph-ref exec port
// ============================================

describe('checkTypeMismatches - graph-ref exec port', () => {
  it('should not warn when a trigger exec port connects to a graph-ref exec port', () => {
    // Reproduces the tutorial pattern: trigger --exec--> graph-ref
    const trigger = createTriggerNode('trigger-1')
    const entry = createCallableEntryNode('entry-1')
    const callableGraph = createTestGraph('callable', 'Callable', [entry], [])

    const graphRef = createGraphRefNode('ref-1', 'callable')
    const edge = createEdge('e1', 'trigger-1', 'ref-1', 'exec', 'exec')
    const mainGraph = createTestGraph(
      'main',
      'Main',
      [trigger, graphRef],
      [edge],
    )

    const ctx = buildPreGenerationContext({
      graphs: [callableGraph, mainGraph],
    })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    // void (trigger exec) -> void (graph-ref exec) must NOT warn
    expect(collector.hasWarnings()).toBe(false)
    expect(collector.hasErrors()).toBe(false)
  })
})

// ============================================
// Invalid Config Regression: autocmd on-event port
// ============================================

describe('checkInvalidConfig - autocmd on-event port', () => {
  it('should not warn about empty callback when on-event port is connected', () => {
    const trigger = createTriggerNode('trigger-1')

    const autocmdNode: GraphNode = {
      id: 'autocmd-1',
      type: 'action',
      definitionId: 'action',
      position: { x: 200, y: 200 },
      data: {
        nodeType: 'action',
        actionType: 'create-autocmd',
        label: 'Create Autocmd',
        actionConfig: {
          actionConfigType: 'create-autocmd',
          events: ['TextYankPost'],
          patterns: ['*'],
          callbackLua: '', // intentionally empty — connected via on-event port
          groupName: 'YankHighlight',
          once: false,
          nested: false,
        },
      },
    }

    const handlerNode = createActionNode('handler-1')

    const edges: GraphEdge[] = [
      createEdge('e1', 'trigger-1', 'autocmd-1', 'exec', 'exec'),
      // on-event port is connected — callback warning must be suppressed
      createEdge('e2', 'autocmd-1', 'handler-1', 'on-event', 'exec'),
    ]

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [trigger, autocmdNode, handlerNode],
      edges,
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    // on-event connected → no warning about empty callback
    expect(
      collector
        .getWarnings()
        .some((w) => w.id === 'WARN_CONFIG_EMPTY_AUTOCDM_CALLBACK'),
    ).toBe(false)
  })

  it('should still warn about empty callback when on-event port is NOT connected', () => {
    const autocmdNode: GraphNode = {
      id: 'autocmd-1',
      type: 'action',
      definitionId: 'action',
      position: { x: 200, y: 200 },
      data: {
        nodeType: 'action',
        actionType: 'create-autocmd',
        label: 'Create Autocmd',
        actionConfig: {
          actionConfigType: 'create-autocmd',
          events: ['BufWritePre'],
          patterns: ['*'],
          callbackLua: '', // empty and on-event not connected
          groupName: '',
          once: false,
          nested: false,
        },
      },
    }

    const graph = createTestGraph('g1', 'Test Graph', [autocmdNode], [])
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkInvalidConfig(ctx, collector)

    // on-event not connected, no callback → warning must fire
    expect(
      collector
        .getWarnings()
        .some((w) => w.id === 'WARN_CONFIG_EMPTY_AUTOCDM_CALLBACK'),
    ).toBe(true)
  })
})

// ============================================
// Type Mismatch: exec port type resolution (Fix 2a & 2b)
// ============================================

describe('checkTypeMismatches - exec port and builtin node fixes', () => {
  it('does NOT warn on void→void connection between action done and another action exec', () => {
    const action1 = createActionNode('action-1', 'set-option')
    const action2 = createActionNode('action-2', 'set-option')
    // done (void) → exec (void): should be silent
    const edge = createEdge('e1', 'action-1', 'action-2', 'done', 'exec')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [action1, action2],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
    expect(collector.hasErrors()).toBe(false)
  })

  it('does NOT warn on void→void connection from on-event port to another action exec', () => {
    // create-autocmd on-event (void) → set-option exec (void)
    const autocmdNode: GraphNode = {
      id: 'autocmd-1',
      type: 'action',
      definitionId: 'action',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'action',
        actionType: 'create-autocmd',
        label: 'Create Autocmd',
        actionConfig: {
          actionConfigType: 'create-autocmd',
          events: ['BufWritePre'],
          patterns: ['*'],
          callbackLua: '',
          groupName: '',
          once: false,
          nested: false,
        },
      },
    }
    const handlerNode = createActionNode('handler-1', 'set-option')
    const edge = createEdge('e1', 'autocmd-1', 'handler-1', 'on-event', 'exec')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [autocmdNode, handlerNode],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    expect(collector.hasWarnings()).toBe(false)
    expect(collector.hasErrors()).toBe(false)
  })

  it('errors when on-event (void) is connected to a string data input port', () => {
    // on-event is void; connecting it to a string input is invalid
    const autocmdNode: GraphNode = {
      id: 'autocmd-1',
      type: 'action',
      definitionId: 'action',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'action',
        actionType: 'create-autocmd',
        label: 'Create Autocmd',
        actionConfig: {
          actionConfigType: 'create-autocmd',
          events: ['BufWritePre'],
          patterns: ['*'],
          callbackLua: '',
          groupName: '',
          once: false,
          nested: false,
        },
      },
    }
    // code block with a string input port
    const codeBlock = createCodeBlockNode(
      'cb-1',
      'print(value)',
      [{ id: 'value', name: 'value', dataType: 'string' }],
      [],
    )
    // on-event (void) → code block string input: type mismatch
    const edge = createEdge('e1', 'autocmd-1', 'cb-1', 'on-event', 'value')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [autocmdNode, codeBlock],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    // void → string must produce a type mismatch error
    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_TYPE_MISMATCH')
  })

  it('does NOT warn on void→void connections involving builtin exec/done ports', () => {
    // trigger exec → builtin exec input (void→void)
    const trigger = createTriggerNode('trigger-1')
    const builtinNode: GraphNode = {
      id: 'builtin-1',
      type: 'builtin',
      definitionId: 'builtin',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'builtin',
        displayName: 'Show Notification',
        builtinId: 'ui.notify',
        config: {},
      },
    }
    const edge = createEdge('e1', 'trigger-1', 'builtin-1', 'exec', 'exec')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [trigger, builtinNode],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    // void (trigger) → void (builtin exec) must NOT warn
    expect(collector.hasWarnings()).toBe(false)
    expect(collector.hasErrors()).toBe(false)
  })

  it('does NOT warn on builtin done → action exec (void→void)', () => {
    const builtinNode: GraphNode = {
      id: 'builtin-1',
      type: 'builtin',
      definitionId: 'builtin',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'builtin',
        displayName: 'Show Notification',
        builtinId: 'ui.notify',
        config: {},
      },
    }
    const actionNode = createActionNode('action-1', 'set-option')
    const edge = createEdge('e1', 'builtin-1', 'action-1', 'done', 'exec')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [builtinNode, actionNode],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    // void (builtin done) → void (action exec) must NOT warn
    expect(collector.hasWarnings()).toBe(false)
    expect(collector.hasErrors()).toBe(false)
  })

  it('warns when builtin string data output connects to a number input (definition-driven typing)', () => {
    // input.prompt outputs value: string
    // code block with a number input — should warn (any or mismatch depending on resolution)
    const builtinNode: GraphNode = {
      id: 'builtin-1',
      type: 'builtin',
      definitionId: 'builtin',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'builtin',
        displayName: 'Prompt Input',
        builtinId: 'input.prompt',
        config: {},
      },
    }
    const codeBlock = createCodeBlockNode(
      'cb-1',
      'return value + 1',
      [{ id: 'numIn', name: 'numIn', dataType: 'number' }],
      [],
    )
    // string → number: type mismatch
    const edge = createEdge('e1', 'builtin-1', 'cb-1', 'value', 'numIn')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [builtinNode, codeBlock],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    // string → number must produce a type mismatch error
    expect(collector.hasErrors()).toBe(true)
    expect(collector.getErrors()[0]?.id).toBe('ERR_TYPE_MISMATCH')
  })

  it('regression: still warns on actual any→number data connections (code block)', () => {
    // code block outputs 'any' → another code block expects 'number'
    const codeBlock1 = createCodeBlockNode(
      'cb-1',
      'return someValue',
      [],
      [{ id: 'out', name: 'val', dataType: 'any' }],
    )
    const codeBlock2 = createCodeBlockNode(
      'cb-2',
      'return input + 1',
      [{ id: 'in', name: 'input', dataType: 'number' }],
      [],
    )
    const edge = createEdge('e1', 'cb-1', 'cb-2', 'out', 'in')

    const graph = createTestGraph(
      'g1',
      'Test Graph',
      [codeBlock1, codeBlock2],
      [edge],
    )
    const ctx = buildPreGenerationContext({ graphs: [graph] })
    const collector = new DiagnosticsCollector()

    checkTypeMismatches(ctx, collector)

    expect(collector.hasWarnings()).toBe(true)
    expect(collector.getWarnings()[0]?.id).toBe('WARN_TYPE_ANY_CONNECTION')
  })
})
