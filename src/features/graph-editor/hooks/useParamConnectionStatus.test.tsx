import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type {
  Graph,
  GraphNode,
  RunFunctionNodeData,
  RunFunctionParamSignature,
} from '@/shared/types'
import { useGraphEditorStore } from '../store'
import { useParamConnectionStatus } from './useParamConnectionStatus'

function createRunFunctionNode(id: string): GraphNode<RunFunctionNodeData> {
  return {
    id,
    type: 'run-function',
    definitionId: 'run-function',
    position: { x: 120, y: 120 },
    data: {
      nodeType: 'run-function',
      selectedFunctionKey: 'vim.fn.expand',
      functionSource: {
        type: 'core',
        functionName: 'expand',
      },
      signature: {
        params: [
          { name: 'foo', type: 'string' },
          { name: 'bar', type: 'number' },
        ],
        returns: 'string',
        luaCall: 'vim.fn.expand($params)',
      },
      paramDefaults: {},
    },
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

function createGraph(): Graph {
  return {
    id: 'graph-1',
    name: 'Test Graph',
    nodes: [
      createTriggerNode('source-node'),
      createRunFunctionNode('run-node'),
    ],
    edges: [
      {
        id: 'edge-foo',
        source: 'source-node',
        sourcePort: 'exec',
        target: 'run-node',
        targetPort: 'param:foo',
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: 1,
    updatedAt: 1,
    enabled: true,
    order: 0,
  }
}

function resetStore(): void {
  useGraphEditorStore.setState((state) => ({
    ...state,
    graph: null,
    selectedNodeIds: [],
    projectPath: null,
  }))
}

describe('useParamConnectionStatus', () => {
  beforeEach(() => {
    resetStore()
  })

  it('returns expected status and keeps reference stable for unrelated updates', () => {
    useGraphEditorStore.getState().loadGraph(createGraph())

    const params: readonly RunFunctionParamSignature[] = [
      { name: 'foo', type: 'string' },
      { name: 'bar', type: 'number' },
    ]

    const { result } = renderHook(() =>
      useParamConnectionStatus('run-node', params),
    )

    expect(result.current).toEqual({ foo: true, bar: false })

    const initialReference = result.current

    act(() => {
      useGraphEditorStore.getState().setSelectedNodes(['run-node'])
    })

    expect(result.current).toBe(initialReference)

    act(() => {
      useGraphEditorStore.getState().addEdge({
        id: 'edge-bar',
        source: 'source-node',
        sourcePort: 'exec',
        target: 'run-node',
        targetPort: 'param:bar',
      })
    })

    expect(result.current).toEqual({ foo: true, bar: true })
  })
})
