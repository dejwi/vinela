import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  ChevronLeft,
  ChevronRight,
  FileCode2,
  Phone,
  Plus,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import type { Graph } from '@/shared/types'
import { useGraphManager } from '../hooks/useGraphManager'
import { useGraphEditorStore } from '../store'
import { getDisableReason } from '../utils/graph-disable-state'
import { CreateGraphDialog } from './CreateGraphDialog'
import { GraphListItem } from './GraphListItem'
import { RenameGraphDialog } from './RenameGraphDialog'

interface GraphSidebarProps {
  projectPath: string
  onGraphSelect: (graph: Graph) => void
  onGraphRename: (graph: Graph, name: string) => Promise<void>
  selectedGraphId?: string | undefined
}

export function GraphSidebar({
  projectPath,
  onGraphSelect,
  onGraphRename,
  selectedGraphId,
}: GraphSidebarProps) {
  const collapsed = useGraphEditorStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useGraphEditorStore((s) => s.setSidebarCollapsed)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [graphToRename, setGraphToRename] = useState<Graph | null>(null)

  const {
    graphs,
    disableStates,
    isLoading,
    createGraph,
    deleteGraph,
    toggleGraphEnabled,
    reorderGraphs,
  } = useGraphManager(projectPath)

  // Set up DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Prevent accidental drags on clicks
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = (_event: DragStartEvent): void => {
    // Can be used for drag overlay in the future
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event

    // Bounds safety checks
    if (!over) return
    if (active.id === over.id) return

    const oldIndex = graphs.findIndex((g) => g.id === active.id)
    const newIndex = graphs.findIndex((g) => g.id === over.id)

    if (
      oldIndex < 0 ||
      newIndex < 0 ||
      oldIndex >= graphs.length ||
      newIndex >= graphs.length
    ) {
      return
    }

    // Reorder and compute updates
    const reordered = arrayMove(graphs, oldIndex, newIndex)

    // Reassign contiguous order values
    const updates = reordered.map((graph, index) => ({
      graphId: graph.id,
      order: index,
    }))

    // Only persist if there are actual changes
    const changedUpdates = updates.filter((update) => {
      const original = graphs.find((g) => g.id === update.graphId)
      return original && original.order !== update.order
    })

    if (changedUpdates.length > 0) {
      void reorderGraphs(changedUpdates)
    }
  }

  if (collapsed) {
    return (
      <div
        data-tutorial="graph-sidebar"
        className="w-10 border-r bg-muted/30 flex flex-col items-center py-2"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarCollapsed(false)}
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="mt-4 space-y-2">
          {graphs.map((graph) => (
            <Button
              key={graph.id}
              variant={selectedGraphId === graph.id ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => onGraphSelect(graph)}
              title={graph.name}
            >
              <GraphIcon graph={graph} className="w-4 h-4" />
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      data-tutorial="graph-sidebar"
      className="w-64 border-r bg-muted/30 flex flex-col"
    >
      {/* Header */}
      <div className="h-12 border-b flex items-center justify-between px-3">
        <span className="font-medium text-sm">Graphs</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCreateDialogOpen(true)}
            title="New graph"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(true)}
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Graph List with DnD */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="text-sm text-muted-foreground px-2">Loading...</div>
          ) : graphs.length === 0 ? (
            <div className="text-sm text-muted-foreground px-2 py-4 text-center">
              No graphs yet.
              <br />
              <Button
                variant="link"
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
              >
                Create your first graph
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={graphs.map((g) => g.id)}
                strategy={verticalListSortingStrategy}
              >
                {graphs.map((graph) => (
                  <GraphListItem
                    key={graph.id}
                    graph={graph}
                    sortableId={graph.id}
                    disableState={disableStates.statesByGraphId.get(graph.id)}
                    isSelected={selectedGraphId === graph.id}
                    onClick={() => onGraphSelect(graph)}
                    onRename={() => {
                      setGraphToRename(graph)
                      setRenameDialogOpen(true)
                    }}
                    onDelete={() => deleteGraph(graph.id)}
                    onToggleEnabled={() => toggleGraphEnabled(graph.id)}
                    disableReason={getDisableReason(
                      disableStates.statesByGraphId.get(graph.id),
                    )}
                    dataTutorial={`graph-item-id-${graph.id}`}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>

      <CreateGraphDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={async (name) => {
          const graph = await createGraph(name)
          onGraphSelect(graph)
          setCreateDialogOpen(false)
        }}
      />

      <RenameGraphDialog
        open={renameDialogOpen}
        graph={graphToRename}
        onOpenChange={(open) => {
          setRenameDialogOpen(open)
          if (!open) {
            setGraphToRename(null)
          }
        }}
        onRename={async (name) => {
          if (!graphToRename) {
            return
          }

          await onGraphRename(graphToRename, name)
        }}
      />
    </div>
  )
}

// Helper to show icon based on graph's entry nodes
function GraphIcon({ graph, className }: { graph: Graph; className?: string }) {
  const hasCallable = graph.nodes.some(
    (n) => n.data.nodeType === 'callable-entry',
  )
  const hasTrigger = graph.nodes.some((n) => n.data.nodeType === 'trigger')

  if (hasCallable) {
    return <Phone className={className} /> // Callable graph
  }
  if (hasTrigger) {
    return <Zap className={className} /> // Triggered graph
  }
  return <FileCode2 className={className} /> // Empty/unknown
}
