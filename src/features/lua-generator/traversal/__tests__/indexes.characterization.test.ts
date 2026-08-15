import { describe, expect, it } from 'vitest'
import { GraphBuilder } from '@/features/lua-generator/__tests__/utils/graph-builder'
import { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import { traverseExecFlow } from '@/features/lua-generator/traversal/exec-traversal'
import { buildGraphIndexes } from '@/features/lua-generator/traversal/indexes'
import type {
  DataEdge,
  ExecEdge,
  IndexedGraph,
  TraversalGenerationContext,
  TraversalGraphIndexes,
} from '@/features/lua-generator/traversal/types'

function requireIndexedGraph(
  indexes: TraversalGraphIndexes,
  graphId: string,
): IndexedGraph {
  const indexed = indexes.byGraph.get(graphId)
  if (indexed === undefined) {
    const available = [...indexes.byGraph.keys()].join(', ')
    throw new Error(
      `Expected indexed graph for id ${JSON.stringify(graphId)} (available: ${available || 'none'})`,
    )
  }
  return indexed
}

function mapEntries<K, V>(map: ReadonlyMap<K, V>): Array<[K, V]> {
  return [...map.entries()]
}

function nestedDataTargetEntries(
  map: ReadonlyMap<string, ReadonlyMap<string, readonly DataEdge[]>>,
): Array<[string, Array<[string, readonly DataEdge[]]>]> {
  return [...map.entries()].map(([nodeId, portMap]) => [
    nodeId,
    [...portMap.entries()],
  ])
}

function projectIndexedGraph(indexed: IndexedGraph): {
  entries: readonly string[]
  nodesById: string[]
  outgoingExecByNode: Array<[string, readonly ExecEdge[]]>
  incomingExecByNode: Array<[string, readonly ExecEdge[]]>
  outgoingDataByNode: Array<[string, readonly DataEdge[]]>
  incomingDataByNode: Array<[string, readonly DataEdge[]]>
  incomingDataByTargetPort: Array<
    [string, Array<[string, readonly DataEdge[]]>]
  >
} {
  return {
    entries: indexed.entries,
    nodesById: [...indexed.nodesById.keys()],
    outgoingExecByNode: mapEntries(indexed.outgoingExecByNode),
    incomingExecByNode: mapEntries(indexed.incomingExecByNode),
    outgoingDataByNode: mapEntries(indexed.outgoingDataByNode),
    incomingDataByNode: mapEntries(indexed.incomingDataByNode),
    incomingDataByTargetPort: nestedDataTargetEntries(
      indexed.incomingDataByTargetPort,
    ),
  }
}

function createCharacterizationGraphs(): [
  ReturnType<GraphBuilder['build']>,
  ReturnType<GraphBuilder['build']>,
] {
  const graphBeta = new GraphBuilder('Graph Beta', 'g-beta')
    .startupTrigger('b-entry')
    .codeBlock('b-cb', 'print("b")', [], [], 'B CB')
    .returnNode('b-ret')
    .connectExec('b-entry', 'b-cb')
    .connectExec('b-cb', 'b-ret')
    .withOrder(2)
    .build()

  const graphAlpha = new GraphBuilder('Graph Alpha', 'g-alpha')
    .startupTrigger('a-entry')
    .condition('a-cond', '>', '1', '0')
    .codeBlock(
      'a-src',
      'return 1',
      [],
      [{ id: 'out-a', name: 'a', dataType: 'number' }],
      'A Src',
    )
    .codeBlock(
      'a-dst1',
      'return input',
      [{ id: 'in1', name: 'input', dataType: 'number' }],
      [],
      'A Dst1',
    )
    .codeBlock(
      'a-dst2',
      'return input',
      [{ id: 'in2', name: 'input', dataType: 'number' }],
      [],
      'A Dst2',
    )
    .codeBlock('a-true', 'print("t")', [], [], 'A True')
    .codeBlock('a-false', 'print("f")', [], [], 'A False')
    .returnNode('a-ret')
    .connectExec('a-entry', 'a-cond')
    .connectTrue('a-cond', 'a-true')
    .connectFalse('a-cond', 'a-false')
    .connectExec('a-true', 'a-src')
    .connectExec('a-src', 'a-ret')
    .connectData('a-src', 'out-a', 'a-dst1', 'in1')
    .connectData('a-src', 'out-a', 'a-dst2', 'in2')
    .withOrder(1)
    .build()

  return [graphBeta, graphAlpha]
}

describe('buildGraphIndexes characterization', () => {
  it('preserves exact multi-graph index projections and traversal order', () => {
    const [graphBeta, graphAlpha] = createCharacterizationGraphs()
    const indexes = buildGraphIndexes([graphBeta, graphAlpha])

    expect(mapEntries(indexes.byGraph).map(([id]) => id)).toEqual([
      'g-beta',
      'g-alpha',
    ])
    expect([...indexes.allNodes.keys()]).toEqual([
      'b-entry',
      'b-cb',
      'b-ret',
      'a-entry',
      'a-cond',
      'a-src',
      'a-dst1',
      'a-dst2',
      'a-true',
      'a-false',
      'a-ret',
    ])

    const beta = requireIndexedGraph(indexes, 'g-beta')
    expect(projectIndexedGraph(beta)).toEqual({
      entries: ['b-entry'],
      nodesById: ['b-entry', 'b-cb', 'b-ret'],
      outgoingExecByNode: [
        [
          'b-entry',
          [
            {
              edgeId: 'edge-b-entry-b-cb-0',
              sourceNodeId: 'b-entry',
              sourcePortId: 'exec',
              targetNodeId: 'b-cb',
              targetPortId: 'exec',
            },
          ],
        ],
        [
          'b-cb',
          [
            {
              edgeId: 'edge-b-cb-b-ret-1',
              sourceNodeId: 'b-cb',
              sourcePortId: 'done',
              targetNodeId: 'b-ret',
              targetPortId: 'exec',
            },
          ],
        ],
        ['b-ret', []],
      ],
      incomingExecByNode: [
        ['b-entry', []],
        [
          'b-cb',
          [
            {
              edgeId: 'edge-b-entry-b-cb-0',
              sourceNodeId: 'b-entry',
              sourcePortId: 'exec',
              targetNodeId: 'b-cb',
              targetPortId: 'exec',
            },
          ],
        ],
        [
          'b-ret',
          [
            {
              edgeId: 'edge-b-cb-b-ret-1',
              sourceNodeId: 'b-cb',
              sourcePortId: 'done',
              targetNodeId: 'b-ret',
              targetPortId: 'exec',
            },
          ],
        ],
      ],
      outgoingDataByNode: [
        ['b-entry', []],
        ['b-cb', []],
        ['b-ret', []],
      ],
      incomingDataByNode: [
        ['b-entry', []],
        ['b-cb', []],
        ['b-ret', []],
      ],
      incomingDataByTargetPort: [
        ['b-entry', []],
        ['b-cb', []],
        ['b-ret', []],
      ],
    })

    const alpha = requireIndexedGraph(indexes, 'g-alpha')
    expect(projectIndexedGraph(alpha)).toEqual({
      entries: ['a-entry'],
      nodesById: [
        'a-entry',
        'a-cond',
        'a-src',
        'a-dst1',
        'a-dst2',
        'a-true',
        'a-false',
        'a-ret',
      ],
      outgoingExecByNode: [
        [
          'a-entry',
          [
            {
              edgeId: 'edge-a-entry-a-cond-0',
              sourceNodeId: 'a-entry',
              sourcePortId: 'exec',
              targetNodeId: 'a-cond',
              targetPortId: 'exec',
            },
          ],
        ],
        [
          'a-cond',
          [
            {
              edgeId: 'edge-a-cond-a-true-1',
              sourceNodeId: 'a-cond',
              sourcePortId: 'true',
              targetNodeId: 'a-true',
              targetPortId: 'exec',
            },
            {
              edgeId: 'edge-a-cond-a-false-2',
              sourceNodeId: 'a-cond',
              sourcePortId: 'false',
              targetNodeId: 'a-false',
              targetPortId: 'exec',
            },
          ],
        ],
        [
          'a-src',
          [
            {
              edgeId: 'edge-a-src-a-ret-4',
              sourceNodeId: 'a-src',
              sourcePortId: 'done',
              targetNodeId: 'a-ret',
              targetPortId: 'exec',
            },
          ],
        ],
        ['a-dst1', []],
        ['a-dst2', []],
        [
          'a-true',
          [
            {
              edgeId: 'edge-a-true-a-src-3',
              sourceNodeId: 'a-true',
              sourcePortId: 'done',
              targetNodeId: 'a-src',
              targetPortId: 'exec',
            },
          ],
        ],
        ['a-false', []],
        ['a-ret', []],
      ],
      incomingExecByNode: [
        ['a-entry', []],
        [
          'a-cond',
          [
            {
              edgeId: 'edge-a-entry-a-cond-0',
              sourceNodeId: 'a-entry',
              sourcePortId: 'exec',
              targetNodeId: 'a-cond',
              targetPortId: 'exec',
            },
          ],
        ],
        [
          'a-src',
          [
            {
              edgeId: 'edge-a-true-a-src-3',
              sourceNodeId: 'a-true',
              sourcePortId: 'done',
              targetNodeId: 'a-src',
              targetPortId: 'exec',
            },
          ],
        ],
        ['a-dst1', []],
        ['a-dst2', []],
        [
          'a-true',
          [
            {
              edgeId: 'edge-a-cond-a-true-1',
              sourceNodeId: 'a-cond',
              sourcePortId: 'true',
              targetNodeId: 'a-true',
              targetPortId: 'exec',
            },
          ],
        ],
        [
          'a-false',
          [
            {
              edgeId: 'edge-a-cond-a-false-2',
              sourceNodeId: 'a-cond',
              sourcePortId: 'false',
              targetNodeId: 'a-false',
              targetPortId: 'exec',
            },
          ],
        ],
        [
          'a-ret',
          [
            {
              edgeId: 'edge-a-src-a-ret-4',
              sourceNodeId: 'a-src',
              sourcePortId: 'done',
              targetNodeId: 'a-ret',
              targetPortId: 'exec',
            },
          ],
        ],
      ],
      outgoingDataByNode: [
        ['a-entry', []],
        ['a-cond', []],
        [
          'a-src',
          [
            {
              edgeId: 'edge-a-src-a-dst1-5',
              sourceNodeId: 'a-src',
              sourcePortId: 'out-a',
              targetNodeId: 'a-dst1',
              targetPortId: 'in1',
            },
            {
              edgeId: 'edge-a-src-a-dst2-6',
              sourceNodeId: 'a-src',
              sourcePortId: 'out-a',
              targetNodeId: 'a-dst2',
              targetPortId: 'in2',
            },
          ],
        ],
        ['a-dst1', []],
        ['a-dst2', []],
        ['a-true', []],
        ['a-false', []],
        ['a-ret', []],
      ],
      incomingDataByNode: [
        ['a-entry', []],
        ['a-cond', []],
        ['a-src', []],
        [
          'a-dst1',
          [
            {
              edgeId: 'edge-a-src-a-dst1-5',
              sourceNodeId: 'a-src',
              sourcePortId: 'out-a',
              targetNodeId: 'a-dst1',
              targetPortId: 'in1',
            },
          ],
        ],
        [
          'a-dst2',
          [
            {
              edgeId: 'edge-a-src-a-dst2-6',
              sourceNodeId: 'a-src',
              sourcePortId: 'out-a',
              targetNodeId: 'a-dst2',
              targetPortId: 'in2',
            },
          ],
        ],
        ['a-true', []],
        ['a-false', []],
        ['a-ret', []],
      ],
      incomingDataByTargetPort: [
        ['a-entry', []],
        ['a-cond', []],
        ['a-src', []],
        [
          'a-dst1',
          [
            [
              'in1',
              [
                {
                  edgeId: 'edge-a-src-a-dst1-5',
                  sourceNodeId: 'a-src',
                  sourcePortId: 'out-a',
                  targetNodeId: 'a-dst1',
                  targetPortId: 'in1',
                },
              ],
            ],
          ],
        ],
        [
          'a-dst2',
          [
            [
              'in2',
              [
                {
                  edgeId: 'edge-a-src-a-dst2-6',
                  sourceNodeId: 'a-src',
                  sourcePortId: 'out-a',
                  targetNodeId: 'a-dst2',
                  targetPortId: 'in2',
                },
              ],
            ],
          ],
        ],
        ['a-true', []],
        ['a-false', []],
        ['a-ret', []],
      ],
    })

    const createContext = (graphId: string): TraversalGenerationContext => ({
      currentGraphId: graphId,
      indentLevel: 0,
      variableCounter: 0,
      graphContracts: new Map(),
    })

    const betaCollector = new DiagnosticsCollector()
    const betaUnits = traverseExecFlow(
      beta.entries[0] ?? '',
      beta,
      createContext('g-beta'),
      betaCollector,
    )
    expect(
      betaUnits.map((unit) => ({
        nodeId: unit.nodeId,
        nodeType: unit.nodeType,
        code: unit.code,
      })),
    ).toEqual([
      { nodeId: 'b-entry', nodeType: 'trigger', code: [] },
      { nodeId: 'b-cb', nodeType: 'code-block', code: [] },
      { nodeId: 'b-ret', nodeType: 'return', code: [] },
    ])

    const alphaCollector = new DiagnosticsCollector()
    const alphaUnits = traverseExecFlow(
      alpha.entries[0] ?? '',
      alpha,
      createContext('g-alpha'),
      alphaCollector,
    )
    expect(
      alphaUnits.map((unit) => ({
        nodeId: unit.nodeId,
        nodeType: unit.nodeType,
        code: unit.code,
      })),
    ).toEqual([
      { nodeId: 'a-entry', nodeType: 'trigger', code: [] },
      { nodeId: 'a-cond', nodeType: 'condition', code: [] },
      { nodeId: 'a-true', nodeType: 'code-block', code: [] },
      { nodeId: 'a-src', nodeType: 'code-block', code: [] },
      { nodeId: 'a-ret', nodeType: 'return', code: [] },
      { nodeId: 'a-false', nodeType: 'code-block', code: [] },
    ])
  })
})
