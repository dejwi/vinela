import { describe, expect, it } from 'vitest'
import type { Graph, GraphDisableState } from '@/shared/types'
import { resolveRunCustomActionTargetStatus } from './custom-action-target-status'

function createGraph(
  id: string,
  options: { callable: boolean; enabled?: boolean; order?: number },
): Graph {
  return {
    id,
    name: `Graph ${id}`,
    nodes: options.callable
      ? [
          {
            id: `entry-${id}`,
            type: 'callable-entry',
            definitionId: 'callable-entry',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'callable-entry',
              parameters: [],
            },
          },
        ]
      : [],
    edges: [],
    createdAt: 1,
    updatedAt: 1,
    enabled: options.enabled ?? true,
    order: options.order ?? 0,
  }
}

function toGraphMap(graphs: readonly Graph[]): ReadonlyMap<string, Graph> {
  return new Map(graphs.map((graph) => [graph.id, graph]))
}

describe('resolveRunCustomActionTargetStatus', () => {
  it('returns missing when graph does not exist', () => {
    const status = resolveRunCustomActionTargetStatus(
      'missing-id',
      toGraphMap([]),
      new Map<string, GraphDisableState>(),
    )

    expect(status).toEqual({ kind: 'missing' })
  })

  it('returns not-callable when target graph has no callable entry', () => {
    const graph = createGraph('g1', { callable: false })

    const status = resolveRunCustomActionTargetStatus(
      graph.id,
      toGraphMap([graph]),
      new Map<string, GraphDisableState>(),
    )

    expect(status).toEqual({ kind: 'not-callable' })
  })

  it('returns disabled with reason when target graph is user-disabled', () => {
    const graph = createGraph('g1', { callable: true })
    const states = new Map<string, GraphDisableState>([
      [
        graph.id,
        {
          graphId: graph.id,
          userEnabled: false,
          effective: { kind: 'user-disabled' },
        },
      ],
    ])

    const status = resolveRunCustomActionTargetStatus(
      graph.id,
      toGraphMap([graph]),
      states,
    )

    expect(status).toEqual({
      kind: 'disabled',
      reason: 'Disabled by you',
    })
  })

  it('returns disabled with dependency reason when graph is blocked', () => {
    const graph = createGraph('g1', { callable: true })
    const states = new Map<string, GraphDisableState>([
      [
        graph.id,
        {
          graphId: graph.id,
          userEnabled: true,
          effective: {
            kind: 'dependency-disabled',
            blockedByRootId: 'root-1',
            blockedByRootName: 'Base Graph',
          },
        },
      ],
    ])

    const status = resolveRunCustomActionTargetStatus(
      graph.id,
      toGraphMap([graph]),
      states,
    )

    expect(status).toEqual({
      kind: 'disabled',
      reason: 'Blocked by: Base Graph',
    })
  })

  it('treats missing disable-state entry as enabled', () => {
    const graph = createGraph('g1', { callable: true })

    const status = resolveRunCustomActionTargetStatus(
      graph.id,
      toGraphMap([graph]),
      new Map<string, GraphDisableState>(),
    )

    expect(status).toEqual({ kind: 'enabled' })
  })
})
