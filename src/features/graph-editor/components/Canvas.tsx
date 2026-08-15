import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  type EdgeTypes,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type OnSelectionChangeFunc,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import '@xyflow/react/dist/style.css'
import './graph-editor.css'
import { v4 as uuidv4 } from 'uuid'
import { useAppSettings } from '@/features/settings/hooks/useAppSettings'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { getSettingWithDefault, SETTING_DEFAULTS } from '@/shared/lib/settings'
import type { GraphEdge, GraphNode, NodeData, NodeType } from '@/shared/types'
import { useGraphEditorStore } from '../store'
import { edgeTypes as registeredEdgeTypes } from './edges'
import { NodePalette } from './NodePalette'
import { nodeTypes as registeredNodeTypes } from './nodes'

// Cast our node types to React Flow's NodeTypes
// This is necessary because our NodeData uses readonly discriminators
// which don't satisfy React Flow's Record<string, unknown> constraint
const nodeTypes = registeredNodeTypes as unknown as NodeTypes

// Cast edge types — EdgeTypes expects ComponentType<EdgeProps & { data?: unknown }>
// but our component is typed with the concrete EdgeProps directly.
const edgeTypes = registeredEdgeTypes as unknown as EdgeTypes

// Convert our GraphNode to React Flow Node
function toFlowNode(n: GraphNode, index: number, isSelected = false): Node {
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    selected: isSelected,
    zIndex: index,
    // Cast data to satisfy React Flow's type requirements
    data: n.data as unknown as Record<string, unknown>,
  }
}

// Convert our GraphEdge to React Flow Edge
function toFlowEdge(e: GraphEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    sourceHandle: e.sourcePort,
    target: e.target,
    targetHandle: e.targetPort,
  }
}

function CanvasInner() {
  const graph = useGraphEditorStore((state) => state.graph)
  const selectedNodeIds = useGraphEditorStore((state) => state.selectedNodeIds)
  const addNodeToStore = useGraphEditorStore((state) => state.addNode)
  const addEdgeToStore = useGraphEditorStore((state) => state.addEdge)
  const updateNode = useGraphEditorStore((state) => state.updateNode)
  const removeNode = useGraphEditorStore((state) => state.removeNode)
  const removeEdge = useGraphEditorStore((state) => state.removeEdge)
  const setSelectedNodes = useGraphEditorStore(
    (state) => state.setSelectedNodes,
  )

  const wrapperRef = useRef<HTMLDivElement>(null)
  const { getViewport, setCenter } = useReactFlow()

  // Settings integration
  const { settings } = useAppSettings()
  const showGrid = settings
    ? getSettingWithDefault(settings, 'showGrid')
    : SETTING_DEFAULTS.showGrid
  const snapToGrid = settings
    ? getSettingWithDefault(settings, 'snapToGrid')
    : SETTING_DEFAULTS.snapToGrid
  const gridSpacing = settings
    ? getSettingWithDefault(settings, 'gridSpacing')
    : SETTING_DEFAULTS.gridSpacing
  const showMinimap = settings
    ? getSettingWithDefault(settings, 'showMinimap')
    : SETTING_DEFAULTS.showMinimap
  const confirmNodeDeletion = settings
    ? getSettingWithDefault(settings, 'confirmNodeDeletion')
    : SETTING_DEFAULTS.confirmNodeDeletion

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const pendingDeletionsRef = useRef<string[]>([])

  const [nodes, setNodes] = useNodesState(
    graph?.nodes.map((node, index) => toFlowNode(node, index, false)) ?? [],
  )
  const [edges, setEdges] = useEdgesState(graph?.edges.map(toFlowEdge) ?? [])

  // Sync nodes from store when graph changes
  useEffect(() => {
    if (graph) {
      const selectedNodeIdSet = new Set(selectedNodeIds)
      setNodes(
        graph.nodes.map((node, index) =>
          toFlowNode(node, index, selectedNodeIdSet.has(node.id)),
        ),
      )
      setEdges(graph.edges.map(toFlowEdge))
    }
  }, [graph, selectedNodeIds, setNodes, setEdges])

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(() => {
    for (const id of pendingDeletionsRef.current) {
      removeNode(id)
    }
    pendingDeletionsRef.current = []
    setDeleteConfirmOpen(false)
  }, [removeNode])

  const handleCancelDelete = useCallback(() => {
    pendingDeletionsRef.current = []
    setDeleteConfirmOpen(false)
  }, [])

  // Handle visual node changes (React Flow local state only)
  // Position changes during drag are handled visually but NOT synced to store
  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Separate remove changes from others
      const removals = changes.filter((c) => c.type === 'remove')
      const otherChanges = changes.filter((c) => c.type !== 'remove')

      // Apply non-removal changes immediately
      if (otherChanges.length > 0) {
        setNodes((nds) => applyNodeChanges(otherChanges, nds))
      }

      // Handle removals
      if (removals.length > 0) {
        const nodeIds = removals.map((r) => r.id)

        if (confirmNodeDeletion) {
          // Show confirmation dialog
          pendingDeletionsRef.current = nodeIds
          setDeleteConfirmOpen(true)
        } else {
          // Delete immediately
          setNodes((nds) => applyNodeChanges(removals, nds))
          for (const id of nodeIds) {
            removeNode(id)
          }
        }
      }
    },
    [setNodes, removeNode, confirmNodeDeletion],
  )

  // Sync position to store only when drag ends
  // This ensures undo restores to position before the entire drag operation
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node, nodes) => {
      // Update all dragged nodes (supports multi-select drag)
      for (const draggedNode of nodes) {
        updateNode(draggedNode.id, { position: draggedNode.position })
      }
      // Also update the primary node if not in the array
      if (!nodes.some((n) => n.id === node.id)) {
        updateNode(node.id, { position: node.position })
      }
    },
    [updateNode],
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds))

      // Sync removals to store
      for (const change of changes) {
        if (change.type === 'remove') {
          removeEdge(change.id)
        }
      }
    },
    [setEdges, removeEdge],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        const newEdge: GraphEdge = {
          id: `e-${connection.source}-${connection.target}-${Date.now()}`,
          source: connection.source,
          sourcePort: connection.sourceHandle ?? 'default',
          target: connection.target,
          targetPort: connection.targetHandle ?? 'default',
        }
        addEdgeToStore(newEdge)
        setEdges((eds) => addEdge(connection, eds))
      }
    },
    [addEdgeToStore, setEdges],
  )

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (selectedNodes.length > 0) {
        setSelectedNodes(selectedNodes.map((node) => node.id))
        return
      }

      if (selectedEdges.length > 0) {
        setSelectedNodes([])
      }
    },
    [setSelectedNodes],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodes([])
  }, [setSelectedNodes])

  // Listen for navigation intent center-on-node events
  useEffect(() => {
    const handleCenterOnNode = (event: Event): void => {
      const { position } = (
        event as CustomEvent<{
          nodeId: string
          position: { x: number; y: number }
        }>
      ).detail
      // Center viewport on the node position with some padding
      setCenter(position.x + 100, position.y + 50, {
        zoom: 1,
        duration: 300,
      })
    }

    window.addEventListener('graph-editor:center-on-node', handleCenterOnNode)
    return () =>
      window.removeEventListener(
        'graph-editor:center-on-node',
        handleCenterOnNode,
      )
  }, [setCenter])

  // Get the center of the current viewport in flow coordinates
  const getViewportCenter = useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) {
      return { x: 100, y: 100 }
    }

    const { x, y, zoom } = getViewport()
    const centerX = (wrapper.clientWidth / 2 - x) / zoom
    const centerY = (wrapper.clientHeight / 2 - y) / zoom

    return { x: centerX, y: centerY }
  }, [getViewport])

  const handleAddNode = useCallback(
    (type: NodeType, data: NodeData) => {
      const viewportCenter = getViewportCenter()
      // Add a small random offset (±20px) to prevent perfect stacking
      const offsetX = (Math.random() - 0.5) * 40
      const offsetY = (Math.random() - 0.5) * 40

      const newNode: GraphNode = {
        id: uuidv4(),
        type,
        definitionId: type,
        position: {
          x: viewportCenter.x + offsetX,
          y: viewportCenter.y + offsetY,
        },
        data,
      }
      addNodeToStore(newNode)
    },
    [addNodeToStore, getViewportCenter],
  )

  return (
    <div
      ref={wrapperRef}
      data-tutorial="graph-canvas"
      className="h-full w-full"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-background"
        proOptions={{ hideAttribution: true }}
        // Snap to grid settings
        snapToGrid={snapToGrid}
        snapGrid={[gridSpacing, gridSpacing]}
      >
        {/* Conditional grid */}
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={gridSpacing}
            size={1}
          />
        )}
        <Controls />
        {/* Conditional minimap */}
        {showMinimap && <MiniMap nodeColor="#666" />}
        <Panel position="top-left">
          <NodePalette onAddNode={handleAddNode} />
        </Panel>
      </ReactFlow>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete{' '}
              {pendingDeletionsRef.current.length === 1 ? 'node' : 'nodes'}?
            </DialogTitle>
            <DialogDescription>
              {pendingDeletionsRef.current.length === 1
                ? 'This will remove the selected node and its connections.'
                : `This will remove ${pendingDeletionsRef.current.length} selected nodes and their connections.`}{' '}
              You can undo this with Ctrl+Z.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
