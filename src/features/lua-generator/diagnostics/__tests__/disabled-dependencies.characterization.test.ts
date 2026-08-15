import { describe, expect, it } from 'vitest'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import type { Graph, GraphEdge, GraphNode } from '@/shared/types'
import { checkDisabledDependencies } from '../checks/disabled-dependencies'
import { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

function createTriggerNode(id: string): GraphNode {
  return {
    id,
    type: 'trigger',
    definitionId: 'trigger-startup',
    position: { x: 0, y: 0 },
    data: { nodeType: 'trigger', triggerType: 'startup' },
  }
}

function createCallableEntryNode(id: string): GraphNode {
  return {
    id,
    type: 'callable-entry',
    definitionId: 'callable-entry-main',
    position: { x: 0, y: 0 },
    data: { nodeType: 'callable-entry', parameters: [] },
  }
}

function createGraphRefNode(id: string, referencedGraphId: string): GraphNode {
  return {
    id,
    type: 'graph-ref',
    definitionId: 'graph-ref-callable',
    position: { x: 100, y: 100 },
    data: { nodeType: 'graph-ref', referencedGraphId },
  }
}

function createTestGraph(
  id: string,
  name: string,
  nodes: GraphNode[],
  enabled = true,
  order = 0,
): Graph {
  return {
    id,
    name,
    nodes,
    edges: [] as GraphEdge[],
    enabled,
    order,
    createdAt: 0,
    updatedAt: 0,
  }
}

function buildCharacterizationContext(graphs: Graph[]): PreGenerationContext {
  const graphsById = new Map(graphs.map((graph) => [graph.id, graph]))
  return {
    graphs,
    graphsById,
    nodesByGraph: new Map(graphs.map((graph) => [graph.id, graph.nodes])),
    edgesByGraph: new Map(graphs.map((graph) => [graph.id, graph.edges])),
    disableStates: new Map([
      [
        'g-caller-user',
        {
          graphId: 'g-caller-user',
          userEnabled: true,
          effective: { kind: 'enabled' },
        },
      ],
      [
        'g-caller-chain',
        {
          graphId: 'g-caller-chain',
          userEnabled: true,
          effective: { kind: 'enabled' },
        },
      ],
      [
        'g-disabled',
        {
          graphId: 'g-disabled',
          userEnabled: false,
          effective: { kind: 'user-disabled' },
        },
      ],
      [
        'g-chain',
        {
          graphId: 'g-chain',
          userEnabled: true,
          effective: {
            kind: 'dependency-disabled',
            blockedByRootId: 'g-disabled',
            blockedByRootName: 'Disabled Target',
          },
        },
      ],
    ]),
    callableContracts: new Map(),
    installedPlugins: [],
    schemas: [],
    targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
  }
}

describe('checkDisabledDependencies characterization', () => {
  it('preserves exact warning payloads for separate caller graphs', () => {
    const callerUser = createTestGraph(
      'g-caller-user',
      'Caller User Disabled',
      [createTriggerNode('t1'), createGraphRefNode('r1', 'g-disabled')],
      true,
      0,
    )
    const callerChain = createTestGraph(
      'g-caller-chain',
      'Caller Chain Disabled',
      [createTriggerNode('t2'), createGraphRefNode('r2', 'g-chain')],
      true,
      1,
    )
    const disabledGraph = createTestGraph(
      'g-disabled',
      'Disabled Target',
      [createCallableEntryNode('e1')],
      false,
      2,
    )
    const chainGraph = createTestGraph(
      'g-chain',
      'Chain Middle',
      [
        createCallableEntryNode('e2'),
        createGraphRefNode('r-inner', 'g-disabled'),
      ],
      true,
      3,
    )

    const ctx = buildCharacterizationContext([
      callerUser,
      callerChain,
      disabledGraph,
      chainGraph,
    ])
    const collector = new DiagnosticsCollector()
    checkDisabledDependencies(ctx, collector)

    expect(collector.getAll()).toEqual([
      {
        id: 'WARN_DEPENDENCY_DISABLED_GRAPH',
        category: 'reference',
        message:
          'Graph "Caller User Disabled" depends on disabled graph "Disabled Target"',
        details:
          'The graph "Disabled Target" is disabled by user. This may cause runtime errors or unexpected behavior. ',
        source: {
          graphId: 'g-caller-user',
          graphName: 'Caller User Disabled',
        },
        suggestions: [
          'Enable the "Disabled Target" graph',
          'Remove the dependency on this graph',
          'Handle the disabled state in "Caller User Disabled" logic',
        ],
        severity: 'warning',
      },
      {
        id: 'WARN_DEPENDENCY_DISABLED_GRAPH',
        category: 'reference',
        message:
          'Graph "Caller Chain Disabled" depends on disabled graph "Chain Middle"',
        details:
          'The graph "Chain Middle" is disabled due to dependency chain. This may cause runtime errors or unexpected behavior. Dependency chain: Chain Middle depends on Disabled Target',
        source: {
          graphId: 'g-caller-chain',
          graphName: 'Caller Chain Disabled',
        },
        suggestions: [
          'Enable the "Chain Middle" graph',
          'Remove the dependency on this graph',
          'Handle the disabled state in "Caller Chain Disabled" logic',
        ],
        severity: 'warning',
      },
    ])
  })
})
