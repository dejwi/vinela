import { describe, expect, it } from 'vitest'
import type { Graph } from '@/shared/types'
import {
  computeDisableStates,
  getDisableReason,
  isGraphDependencyDisabled,
  isGraphEffectivelyEnabled,
  isGraphUserDisabled,
} from './graph-disable-state'

function createGraph(
  id: string,
  name: string,
  enabled: boolean,
  order: number,
  referencedGraphIds: string[] = [],
): Graph {
  return {
    id,
    name,
    enabled,
    order,
    nodes: referencedGraphIds.map((refId) => ({
      id: `node-${refId}`,
      type: 'graph-ref',
      definitionId: 'graph-ref',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'graph-ref',
        referencedGraphId: refId,
      },
    })),
    edges: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

describe('computeDisableStates', () => {
  it('returns enabled state for all graphs when all are enabled', () => {
    const graphs: Graph[] = [
      createGraph('g1', 'Graph 1', true, 0),
      createGraph('g2', 'Graph 2', true, 1),
      createGraph('g3', 'Graph 3', true, 2),
    ]

    const result = computeDisableStates(graphs)

    expect(result.statesByGraphId.size).toBe(3)
    for (const graph of graphs) {
      const state = result.statesByGraphId.get(graph.id)
      expect(state).toBeDefined()
      expect(state?.userEnabled).toBe(true)
      expect(state?.effective.kind).toBe('enabled')
    }
  })

  it('marks user-disabled graphs correctly', () => {
    const graphs: Graph[] = [
      createGraph('g1', 'Graph 1', false, 0),
      createGraph('g2', 'Graph 2', true, 1),
    ]

    const result = computeDisableStates(graphs)

    const g1State = result.statesByGraphId.get('g1')
    expect(g1State?.effective.kind).toBe('user-disabled')
    expect(isGraphUserDisabled(g1State)).toBe(true)

    const g2State = result.statesByGraphId.get('g2')
    expect(g2State?.effective.kind).toBe('enabled')
    expect(isGraphEffectivelyEnabled(g2State)).toBe(true)
  })

  it('propagates disable state to dependents', () => {
    // g1 is disabled, g2 references g1
    const g1 = createGraph('g1', 'Graph 1', false, 0)
    const g2 = createGraph('g2', 'Graph 2', true, 1, ['g1'])

    const result = computeDisableStates([g1, g2])

    const g1State = result.statesByGraphId.get('g1')
    expect(g1State?.effective.kind).toBe('user-disabled')

    const g2State = result.statesByGraphId.get('g2')
    expect(g2State?.effective.kind).toBe('dependency-disabled')
    expect(isGraphDependencyDisabled(g2State)).toBe(true)

    if (g2State?.effective.kind === 'dependency-disabled') {
      expect(g2State.effective.blockedByRootId).toBe('g1')
      expect(g2State.effective.blockedByRootName).toBe('Graph 1')
    }
  })

  it('propagates disable state transitively', () => {
    // g1 is disabled, g2 references g1, g3 references g2
    const g1 = createGraph('g1', 'Graph 1', false, 0)
    const g2 = createGraph('g2', 'Graph 2', true, 1, ['g1'])
    const g3 = createGraph('g3', 'Graph 3', true, 2, ['g2'])

    const result = computeDisableStates([g1, g2, g3])

    expect(result.statesByGraphId.get('g1')?.effective.kind).toBe(
      'user-disabled',
    )
    expect(result.statesByGraphId.get('g2')?.effective.kind).toBe(
      'dependency-disabled',
    )
    expect(result.statesByGraphId.get('g3')?.effective.kind).toBe(
      'dependency-disabled',
    )
  })

  it('handles multiple disabled roots', () => {
    // g1 and g2 are disabled, g3 references both
    const g1 = createGraph('g1', 'Graph 1', false, 0)
    const g2 = createGraph('g2', 'Graph 2', false, 1)
    const g3 = createGraph('g3', 'Graph 3', true, 2, ['g1', 'g2'])

    const result = computeDisableStates([g1, g2, g3])

    expect(result.statesByGraphId.get('g1')?.effective.kind).toBe(
      'user-disabled',
    )
    expect(result.statesByGraphId.get('g2')?.effective.kind).toBe(
      'user-disabled',
    )

    const g3State = result.statesByGraphId.get('g3')
    expect(g3State?.effective.kind).toBe('dependency-disabled')
    // Should be blocked by the first discovered root (g1 due to iteration order)
    if (g3State?.effective.kind === 'dependency-disabled') {
      expect(g3State.effective.blockedByRootId).toBe('g1')
    }
  })

  it('handles cycles without user-disabled roots (all enabled)', () => {
    // Circular reference: g1 -> g2 -> g3 -> g1
    const g1 = createGraph('g1', 'Graph 1', true, 0, ['g2'])
    const g2 = createGraph('g2', 'Graph 2', true, 1, ['g3'])
    const g3 = createGraph('g3', 'Graph 3', true, 2, ['g1'])

    const result = computeDisableStates([g1, g2, g3])

    // No user-disabled root, so all should be enabled
    expect(result.statesByGraphId.get('g1')?.effective.kind).toBe('enabled')
    expect(result.statesByGraphId.get('g2')?.effective.kind).toBe('enabled')
    expect(result.statesByGraphId.get('g3')?.effective.kind).toBe('enabled')
  })

  it('handles cycles with user-disabled roots (propagates through cycle)', () => {
    // Circular reference: g1 -> g2 -> g3 -> g1, with g1 disabled
    const g1 = createGraph('g1', 'Graph 1', false, 0, ['g2'])
    const g2 = createGraph('g2', 'Graph 2', true, 1, ['g3'])
    const g3 = createGraph('g3', 'Graph 3', true, 2, ['g1'])

    const result = computeDisableStates([g1, g2, g3])

    expect(result.statesByGraphId.get('g1')?.effective.kind).toBe(
      'user-disabled',
    )
    expect(result.statesByGraphId.get('g2')?.effective.kind).toBe(
      'dependency-disabled',
    )
    expect(result.statesByGraphId.get('g3')?.effective.kind).toBe(
      'dependency-disabled',
    )
  })

  it('handles orphaned graph-ref nodes (references non-existent graph)', () => {
    const g1 = createGraph('g1', 'Graph 1', true, 0, ['non-existent'])

    const result = computeDisableStates([g1])

    // Should still be enabled since the target doesn't exist
    expect(result.statesByGraphId.get('g1')?.effective.kind).toBe('enabled')
  })
})

describe('getDisableReason', () => {
  it('returns empty string for enabled state', () => {
    const state = {
      graphId: 'g1',
      userEnabled: true,
      effective: { kind: 'enabled' as const },
    }
    expect(getDisableReason(state)).toBe('')
  })

  it('returns correct message for user-disabled', () => {
    const state = {
      graphId: 'g1',
      userEnabled: false,
      effective: { kind: 'user-disabled' as const },
    }
    expect(getDisableReason(state)).toBe('Disabled by you')
  })

  it('returns correct message for dependency-disabled', () => {
    const state = {
      graphId: 'g2',
      userEnabled: true,
      effective: {
        kind: 'dependency-disabled' as const,
        blockedByRootId: 'g1',
        blockedByRootName: 'Graph 1',
      },
    }
    expect(getDisableReason(state)).toBe('Blocked by: Graph 1')
  })
})
