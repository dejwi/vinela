import { temporal } from 'zundo'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  ActionNodeData,
  Graph,
  GraphEdge,
  GraphNode,
  GraphViewport,
  NodeData,
} from '@/shared/types'
import {
  normalizeActionNodeData,
  normalizeGraphForEditor,
} from '@/shared/types'
import { getBuiltinActionDefinition } from './data/builtin-actions'

type NodeDataUpdates<T extends NodeData = NodeData> = Partial<
  Omit<T, 'nodeType'>
>

function normalizeActionNodeDataForStore(data: ActionNodeData): ActionNodeData {
  return data
}

function normalizeGraphForStore(graph: Graph): Graph {
  const normalizedGraph = normalizeGraphForEditor(graph)

  return {
    ...normalizedGraph,
    nodes: normalizedGraph.nodes.map((node) => {
      if (node.data.nodeType === 'action') {
        return {
          ...node,
          data: normalizeActionNodeDataForStore(node.data),
        }
      }

      return node
    }),
  }
}

function mergeNodeData(
  currentData: NodeData,
  dataUpdates: NodeDataUpdates,
): NodeData {
  if (currentData.nodeType === 'action') {
    const normalizedData = normalizeActionNodeData({
      ...currentData,
      ...dataUpdates,
    })
    return normalizeActionNodeDataForStore(normalizedData)
  }

  // Use type assertion to handle exactOptionalPropertyTypes constraint
  // The spread is safe here because we're merging partial updates into existing data
  return { ...currentData, ...dataUpdates } as NodeData
}

export interface NodePortSets {
  inputs: Set<string>
  outputs: Set<string>
}

// Port definitions by action type — easy to extend
const ACTION_PORT_EXTENSIONS: Record<
  string,
  { inputs?: string[]; outputs?: string[] }
> = {
  'set-option': { inputs: ['value'] },
  'set-keymap': { inputs: ['on-press', 'key-sequence'] },
  'set-variable': { inputs: ['value'] },
  'set-highlight': { inputs: ['foreground', 'background', 'group-name'] },
  'get-variable': { outputs: ['value'] },
  'create-autocmd': { outputs: ['on-event'] },
}

function getActionNodePorts(actionType: string): NodePortSets {
  const inputs = new Set<string>(['exec'])
  const outputs = new Set<string>(['done'])

  const extensions = ACTION_PORT_EXTENSIONS[actionType]
  if (extensions !== undefined) {
    if (extensions.inputs !== undefined) {
      for (const port of extensions.inputs) inputs.add(port)
    }
    if (extensions.outputs !== undefined) {
      for (const port of extensions.outputs) outputs.add(port)
    }
  }

  return { inputs, outputs }
}

export function collectNodePortSets(node: GraphNode): NodePortSets | null {
  switch (node.data.nodeType) {
    case 'trigger':
      return {
        inputs: new Set(),
        outputs: new Set(['exec']),
      }
    case 'action':
      return getActionNodePorts(node.data.actionType)
    case 'condition':
      return {
        inputs: new Set(['a', 'b']),
        outputs: new Set(['true', 'false']),
      }
    case 'loop': {
      const outputs = new Set<string>(['loop', 'done'])
      if (node.data.loopType === 'for' || node.data.loopType === 'each') {
        outputs.add('item')
        outputs.add('index')
      }

      return {
        inputs: new Set(['exec']),
        outputs,
      }
    }
    case 'code-block':
      return {
        inputs: new Set(['exec', ...node.data.inputs.map((port) => port.id)]),
        outputs: new Set(['done', ...node.data.outputs.map((port) => port.id)]),
      }
    case 'graph-ref':
      return {
        inputs: new Set([
          'exec',
          ...(node.data.cachedContract?.parameters.map((port) => port.id) ??
            []),
        ]),
        outputs: new Set([
          'done',
          ...(node.data.cachedContract?.returnValues.map((port) => port.id) ??
            []),
        ]),
      }
    case 'callable-entry':
      return {
        inputs: new Set(),
        outputs: new Set([
          'exec',
          ...node.data.parameters.map((port) => port.id),
        ]),
      }
    case 'return':
      return {
        inputs: new Set([
          'exec',
          ...node.data.returnValues.map((port) => port.id),
        ]),
        outputs: new Set(),
      }
    case 'run-function': {
      const inputs = new Set<string>(['exec'])
      const outputs = new Set<string>(['done'])
      if (node.data.signature) {
        for (const param of node.data.signature.params) {
          inputs.add(`param:${param.name}`)
        }
        if (node.data.signature.returns !== 'void') {
          outputs.add('result')
        }
      }
      return { inputs, outputs }
    }
    case 'builtin': {
      const definition = getBuiltinActionDefinition(node.data.builtinId)
      if (!definition) return null

      return {
        inputs: new Set(definition.inputs.map((p) => p.id)),
        outputs: new Set(definition.outputs.map((p) => p.id)),
      }
    }
  }
}

function isEdgePortValid(portId: string, allowedPorts: Set<string>): boolean {
  if (portId === 'default') {
    return true
  }

  return allowedPorts.has(portId)
}

function reconcileNodeEdges(graph: Graph, nodeId: string): void {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) {
    return
  }

  const nodePorts = collectNodePortSets(node)
  if (!nodePorts) {
    return
  }

  graph.edges = graph.edges.filter((edge) => {
    const validSource =
      edge.source !== nodeId ||
      isEdgePortValid(edge.sourcePort, nodePorts.outputs)
    const validTarget =
      edge.target !== nodeId ||
      isEdgePortValid(edge.targetPort, nodePorts.inputs)
    return validSource && validTarget
  })
}

interface GraphEditorState {
  // State
  graph: Graph | null
  selectedNodeIds: string[]
  projectPath: string | null // Absolute path to current project
  showNodeDebugInfo: boolean
  /** Whether the graph sidebar is collapsed */
  readonly sidebarCollapsed: boolean

  // Actions
  setProjectPath: (path: string) => void
  loadGraph: (graph: Graph) => void
  addNode: (node: GraphNode) => void
  updateNode: (
    id: string,
    updates: Partial<Omit<GraphNode, 'id' | 'data'>> & {
      data?: NodeDataUpdates
    },
  ) => void
  updateNodeData: <T extends NodeData>(
    id: string,
    data: NodeDataUpdates<T>,
  ) => void
  removeNode: (id: string) => void
  addEdge: (edge: GraphEdge) => void
  removeEdge: (id: string) => void
  setSelectedNodes: (ids: string[]) => void
  updateViewport: (viewport: GraphViewport) => void
  clearGraph: () => void
  resetForProjectClose: () => void
  /** Set sidebar collapsed state */
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useGraphEditorStore = create<GraphEditorState>()(
  temporal(
    immer((set) => ({
      graph: null,
      selectedNodeIds: [],
      projectPath: null,
      showNodeDebugInfo: false,
      sidebarCollapsed: false,

      setProjectPath: (path) =>
        set((state) => {
          state.projectPath = path
        }),

      loadGraph: (graph) =>
        set((state) => {
          state.graph = normalizeGraphForStore(graph)
          if (state.graph) {
            for (const node of state.graph.nodes) {
              reconcileNodeEdges(state.graph, node.id)
            }
          }
          state.selectedNodeIds = []
        }),

      addNode: (node) =>
        set((state) => {
          if (state.graph) {
            const normalizedNode: GraphNode =
              node.data.nodeType === 'action'
                ? {
                    ...node,
                    data: normalizeActionNodeDataForStore(
                      normalizeActionNodeData(node.data),
                    ),
                  }
                : node

            state.graph.nodes.push(normalizedNode)
            state.graph.updatedAt = Date.now()
          }
        }),

      updateNode: (id, updates) =>
        set((state) => {
          if (!state.graph) return

          const node = state.graph.nodes.find((n) => n.id === id)
          if (!node) return
          // Apply updates using Object.assign for simple properties
          Object.assign(node, {
            ...(updates.position && { position: updates.position }),
            ...(updates.type && { type: updates.type }),
            ...(updates.definitionId && { definitionId: updates.definitionId }),
            ...(updates.data && {
              data: mergeNodeData(node.data, updates.data),
            }),
          })

          if (updates.data) {
            reconcileNodeEdges(state.graph, id)
          }

          state.graph.updatedAt = Date.now()
        }),

      updateNodeData: <T extends NodeData>(
        id: string,
        dataUpdates: NodeDataUpdates<T>,
      ) =>
        set((state) => {
          if (state.graph) {
            const node = state.graph.nodes.find((n) => n.id === id)
            if (node) {
              node.data = mergeNodeData(node.data, dataUpdates)
              reconcileNodeEdges(state.graph, id)
              state.graph.updatedAt = Date.now()
            }
          }
        }),

      removeNode: (id) =>
        set((state) => {
          if (state.graph) {
            state.graph.nodes = state.graph.nodes.filter((n) => n.id !== id)
            state.graph.edges = state.graph.edges.filter(
              (e) => e.source !== id && e.target !== id,
            )
            state.selectedNodeIds = state.selectedNodeIds.filter(
              (nid) => nid !== id,
            )
            state.graph.updatedAt = Date.now()
          }
        }),

      addEdge: (edge) =>
        set((state) => {
          if (state.graph) {
            state.graph.edges.push(edge)
            state.graph.updatedAt = Date.now()
          }
        }),

      removeEdge: (id) =>
        set((state) => {
          if (state.graph) {
            state.graph.edges = state.graph.edges.filter((e) => e.id !== id)
            state.graph.updatedAt = Date.now()
          }
        }),

      setSelectedNodes: (ids) =>
        set((state) => {
          state.selectedNodeIds = ids
        }),

      updateViewport: (viewport) =>
        set((state) => {
          if (state.graph) {
            state.graph.viewport = viewport
          }
        }),

      clearGraph: () =>
        set((state) => {
          state.graph = null
          state.selectedNodeIds = []
        }),

      resetForProjectClose: () => {
        // Clear the main state
        set((state) => {
          state.graph = null
          state.selectedNodeIds = []
          state.projectPath = null
          state.sidebarCollapsed = false
        })

        // Clear undo/redo history to prevent cross-project operations
        useGraphEditorStore.temporal.getState().clear()
      },

      setSidebarCollapsed: (collapsed) =>
        set((state) => {
          state.sidebarCollapsed = collapsed
        }),
    })),
  ),
)

// Hook to access undo/redo
export function useGraphHistory() {
  const store = useGraphEditorStore
  return {
    undo: () => store.temporal.getState().undo(),
    redo: () => store.temporal.getState().redo(),
    canUndo: () => store.temporal.getState().pastStates.length > 0,
    canRedo: () => store.temporal.getState().futureStates.length > 0,
  }
}
