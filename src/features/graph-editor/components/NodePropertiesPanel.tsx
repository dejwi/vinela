import { SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { type NodeData, resolveNodeDisplayName } from '@/shared/types'
import { getBuiltinActionDefinition } from '../data/builtin-actions'
import { useGraphEditorStore } from '../store'
import { useGraphManagerContext } from './GraphManagerContext'
import { NodePropertiesRouter } from './properties/NodePropertiesRouter'
import { PropertiesNotice } from './properties/shared'

const DEFAULT_PANEL_WIDTH = 320
const MIN_PANEL_WIDTH = 260
const MAX_PANEL_WIDTH = 640
const MIN_CANVAS_WIDTH = 240

function clampPanelWidth(width: number): number {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width))
}

function getAllowedPanelWidth(
  requestedWidth: number,
  parentWidth: number | null,
): number {
  const clampedRequest = clampPanelWidth(requestedWidth)

  if (parentWidth === null) {
    return clampedRequest
  }

  const maxWithCanvasReserve = parentWidth - MIN_CANVAS_WIDTH
  const maxPanelWidth = Math.min(
    MAX_PANEL_WIDTH,
    Math.max(MIN_PANEL_WIDTH, maxWithCanvasReserve),
    parentWidth,
  )

  return Math.max(Math.min(clampedRequest, maxPanelWidth), 0)
}

function toLabel(value: string): string {
  return value
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

function getTriggerLabel(): string {
  return 'On Startup'
}

function getLoopLabel(loopType: 'for' | 'while' | 'each'): string {
  switch (loopType) {
    case 'for':
      return 'For Loop'
    case 'while':
      return 'While Loop'
    case 'each':
      return 'Each Loop'
  }
}

export function NodePropertiesPanel() {
  // Individual selectors to avoid creating new object references on every render
  const updateNodeData = useGraphEditorStore((state) => state.updateNodeData)
  const graph = useGraphEditorStore((state) => state.graph)
  const selectedNodeIds = useGraphEditorStore((state) => state.selectedNodeIds)
  const showNodeDebugInfo = useGraphEditorStore(
    (state) => state.showNodeDebugInfo,
  )
  const { graphs } = useGraphManagerContext()
  const panelRef = useRef<HTMLElement | null>(null)
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  )
  const cleanupResizeListenersRef = useRef<(() => void) | null>(null)
  const [panelWidth, setPanelWidth] = useState<number>(DEFAULT_PANEL_WIDTH)

  const selectedNodes = useMemo(() => {
    if (!graph || selectedNodeIds.length === 0) {
      return []
    }

    const selectedIdSet = new Set(selectedNodeIds)
    return graph.nodes.filter((node) => selectedIdSet.has(node.id))
  }, [graph, selectedNodeIds])

  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined

  const selectedNodeNameFallback = useMemo(() => {
    if (!selectedNode) {
      return ''
    }

    switch (selectedNode.data.nodeType) {
      case 'trigger':
        return getTriggerLabel()
      case 'action':
        return selectedNode.data.label || 'Action'
      case 'condition':
        return 'Condition'
      case 'loop':
        return getLoopLabel(selectedNode.data.loopType)
      case 'code-block':
        return 'Code Block'
      case 'graph-ref': {
        const referencedGraphId = selectedNode.data.referencedGraphId
        const referencedGraph = graphs.find(
          (candidate) => candidate.id === referencedGraphId,
        )
        return referencedGraph?.name ?? 'Graph Reference'
      }
      case 'run-function': {
        const fnKey = selectedNode.data.selectedFunctionKey
        return fnKey.length > 0 ? fnKey : 'Run Function'
      }
      case 'builtin': {
        const builtinDefinition = getBuiltinActionDefinition(
          selectedNode.data.builtinId,
        )
        return builtinDefinition?.label ?? 'Missing Builtin'
      }
      case 'callable-entry':
        return 'Callable Entry'
      case 'return':
        return 'Return'
    }
  }, [graphs, selectedNode])

  const resolveWidth = useCallback((requestedWidth: number): number => {
    const parentWidth = panelRef.current?.parentElement?.clientWidth ?? null
    return getAllowedPanelWidth(requestedWidth, parentWidth)
  }, [])

  useEffect(() => {
    setPanelWidth((currentWidth) => resolveWidth(currentWidth))

    const onResize = () => {
      setPanelWidth((currentWidth) => resolveWidth(currentWidth))
    }

    const parentElement = panelRef.current?.parentElement
    const resizeObserver =
      parentElement && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            setPanelWidth((currentWidth) => resolveWidth(currentWidth))
          })
        : null

    if (resizeObserver && parentElement) {
      resizeObserver.observe(parentElement)
    }

    window.addEventListener('resize', onResize)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [resolveWidth])

  useEffect(() => {
    return () => {
      cleanupResizeListenersRef.current?.()
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [])

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      cleanupResizeListenersRef.current?.()

      dragStateRef.current = {
        startX: event.clientX,
        startWidth: panelWidth,
      }
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const dragState = dragStateRef.current
        if (!dragState) {
          return
        }

        const delta = dragState.startX - moveEvent.clientX
        const nextWidth = resolveWidth(dragState.startWidth + delta)
        setPanelWidth(nextWidth)
      }

      const stopResizing = () => {
        dragStateRef.current = null
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', stopResizing)
        window.removeEventListener('pointercancel', stopResizing)
        window.removeEventListener('blur', stopResizing)
        cleanupResizeListenersRef.current = null
      }

      cleanupResizeListenersRef.current = stopResizing
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', stopResizing)
      window.addEventListener('pointercancel', stopResizing)
      window.addEventListener('blur', stopResizing)
    },
    [panelWidth, resolveWidth],
  )

  return (
    <aside
      ref={panelRef}
      data-tutorial="properties-panel"
      className="relative min-h-0 min-w-0 max-w-full border-l bg-background/95 flex flex-col"
      style={{ width: `${panelWidth}px` }}
    >
      <button
        type="button"
        aria-label="Resize node properties panel"
        className="absolute left-0 top-0 h-full w-1 -translate-x-1/2 cursor-col-resize bg-transparent hover:bg-border/60"
        onPointerDown={handleResizeStart}
      />
      <div className="h-12 shrink-0 border-b px-4 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Node Properties</h2>
      </div>

      <div className="relative min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="min-w-0 p-4 pb-6">
            {selectedNodes.length === 0 ? (
              <PropertiesNotice
                title="No node selected"
                description="Select a node on the canvas to edit its properties here."
              />
            ) : null}

            {selectedNodes.length > 1 ? (
              <PropertiesNotice
                title="Multiple nodes selected"
                description={`${selectedNodes.length} nodes are selected. Multi-edit is not available yet.`}
              />
            ) : null}

            {selectedNode ? (
              <div className="space-y-4">
                {showNodeDebugInfo ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Selected Node
                    </p>
                    <p className="text-sm font-medium">
                      {toLabel(selectedNode.data.nodeType)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {selectedNode.id}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Node Name</p>
                  <Input
                    value={resolveNodeDisplayName(
                      selectedNode.data.displayName,
                      selectedNodeNameFallback,
                    )}
                    onChange={(event) =>
                      updateNodeData<NodeData>(selectedNode.id, {
                        displayName: event.target.value || undefined,
                      })
                    }
                    placeholder="Optional custom node name"
                  />
                </div>

                <NodePropertiesRouter node={selectedNode} />
              </div>
            ) : null}
          </div>
        </ScrollArea>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-background to-transparent" />
      </div>
    </aside>
  )
}
