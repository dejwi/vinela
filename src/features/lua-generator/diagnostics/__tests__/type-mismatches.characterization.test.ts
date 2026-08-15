import { describe, expect, it } from 'vitest'
import type { Graph, GraphEdge, GraphNode } from '@/shared/types'
import { checkTypeMismatches } from '../checks/type-mismatches'
import { DiagnosticsCollector } from '../collector'
import { buildPreGenerationContext } from '../index'

function createTriggerNode(id: string): GraphNode {
  return {
    id,
    type: 'trigger',
    definitionId: 'trigger-startup',
    position: { x: 0, y: 0 },
    data: { nodeType: 'trigger', triggerType: 'startup' },
  }
}

function createCodeBlockNode(
  id: string,
  inputs: Array<{
    id: string
    name: string
    dataType: 'any' | 'string' | 'number' | 'boolean'
  }>,
  outputs: Array<{
    id: string
    name: string
    dataType: 'string' | 'number' | 'boolean'
  }>,
): GraphNode {
  return {
    id,
    type: 'code-block',
    definitionId: 'code-block-exec',
    position: { x: 100, y: 100 },
    data: {
      nodeType: 'code-block',
      code: 'return 1',
      inputs,
      outputs,
    },
  }
}

function createActionNode(id: string): GraphNode {
  return {
    id,
    type: 'action',
    definitionId: 'action-set-option',
    position: { x: 200, y: 100 },
    data: {
      nodeType: 'action',
      actionType: 'set-option',
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

function createEdge(
  id: string,
  source: string,
  target: string,
  sourcePort: string,
  targetPort: string,
): GraphEdge {
  return {
    id,
    source,
    sourcePort,
    target,
    targetPort,
  }
}

function createTestGraph(
  id: string,
  name: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  order: number,
): Graph {
  return {
    id,
    name,
    nodes,
    edges,
    enabled: true,
    order,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('checkTypeMismatches characterization', () => {
  it('preserves exact diagnostic order across multiple graphs', () => {
    const anyGraph = createTestGraph(
      'g-any',
      'Any Graph',
      [
        createCodeBlockNode(
          'cb-out',
          [],
          [{ id: 'out-any', name: 'value', dataType: 'string' }],
        ),
        createCodeBlockNode(
          'cb-in',
          [{ id: 'in1', name: 'input', dataType: 'any' }],
          [],
        ),
      ],
      [createEdge('e-any', 'cb-out', 'cb-in', 'out-any', 'in1')],
      0,
    )
    const mismatchOne = createTestGraph(
      'g-m1',
      'Mismatch One',
      [
        createCodeBlockNode(
          'cb-num',
          [],
          [{ id: 'out-num', name: 'count', dataType: 'number' }],
        ),
        createCodeBlockNode(
          'cb-str',
          [{ id: 'in-str', name: 'label', dataType: 'string' }],
          [],
        ),
      ],
      [createEdge('e-m1', 'cb-num', 'cb-str', 'out-num', 'in-str')],
      1,
    )
    const mismatchTwo = createTestGraph(
      'g-m2',
      'Mismatch Two',
      [
        createCodeBlockNode(
          'cb-bool',
          [],
          [{ id: 'out-bool', name: 'flag', dataType: 'boolean' }],
        ),
        createCodeBlockNode(
          'cb-num2',
          [{ id: 'in-num', name: 'value', dataType: 'number' }],
          [],
        ),
      ],
      [createEdge('e-m2', 'cb-bool', 'cb-num2', 'out-bool', 'in-num')],
      2,
    )
    const execGraph = createTestGraph(
      'g-exec',
      'Exec Graph',
      [createTriggerNode('trigger-1'), createActionNode('action-1')],
      [createEdge('e-exec', 'trigger-1', 'action-1', 'exec', 'exec')],
      3,
    )

    const ctx = buildPreGenerationContext({
      graphs: [anyGraph, mismatchOne, mismatchTwo, execGraph],
    })
    const collector = new DiagnosticsCollector()
    checkTypeMismatches(ctx, collector)

    expect(collector.getAll()).toEqual([
      {
        id: 'ERR_TYPE_MISMATCH',
        category: 'reference',
        message: 'Cannot connect number to string',
        details:
          'Type mismatch: output port "out-num" produces number but input port "in-str" expects string.',
        source: {
          graphId: 'g-m1',
          graphName: 'Mismatch One',
          nodeId: 'cb-num',
          portId: 'out-num',
        },
        suggestions: [
          'Change source to output string',
          'Change target to accept number',
          'Use a code block to convert between types',
        ],
        severity: 'error',
      },
      {
        id: 'ERR_TYPE_MISMATCH',
        category: 'reference',
        message: 'Cannot connect boolean to number',
        details:
          'Type mismatch: output port "out-bool" produces boolean but input port "in-num" expects number.',
        source: {
          graphId: 'g-m2',
          graphName: 'Mismatch Two',
          nodeId: 'cb-bool',
          portId: 'out-bool',
        },
        suggestions: [
          'Change source to output number',
          'Change target to accept boolean',
          'Use a code block to convert between types',
        ],
        severity: 'error',
      },
      {
        id: 'WARN_TYPE_ANY_CONNECTION',
        category: 'reference',
        message: "Connection uses 'any' type - type safety reduced",
        details:
          'Edge from port "out-any" (string) to port "in1" (any) uses loose typing. Consider specifying explicit types.',
        source: {
          graphId: 'g-any',
          graphName: 'Any Graph',
          nodeId: 'cb-out',
          portId: 'out-any',
        },
        suggestions: [
          'Specify explicit data types for code block ports',
          'Use specific types (string, number, boolean, table) instead of any',
        ],
        severity: 'warning',
      },
    ])
  })

  it('preserves void exec port typing for trigger to action connection', () => {
    const execGraph = createTestGraph(
      'g-exec-only',
      'Exec Graph',
      [createTriggerNode('trigger-1'), createActionNode('action-1')],
      [createEdge('e-exec', 'trigger-1', 'action-1', 'exec', 'exec')],
      0,
    )

    const ctx = buildPreGenerationContext({ graphs: [execGraph] })
    const collector = new DiagnosticsCollector()
    checkTypeMismatches(ctx, collector)

    expect(collector.getAll()).toEqual([])
  })
})
