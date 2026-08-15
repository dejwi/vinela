import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertCircle,
  FileCode2,
  MoreVertical,
  Pencil,
  Phone,
  Power,
  PowerOff,
  Trash2,
  Zap,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import type { Graph, GraphDisableState } from '@/shared/types'

export interface GraphListItemProps {
  graph: Graph
  /** Computed disable state (effective state, not user intent) */
  disableState?: GraphDisableState | undefined
  /** Whether this graph is currently selected */
  isSelected: boolean
  /** Click handler for selecting the graph */
  onClick: () => void
  /** Rename handler */
  onRename: () => void
  /** Delete handler */
  onDelete: () => void
  /** Toggle enabled handler (user intent) */
  onToggleEnabled: () => void
  /** Pre-computed disable reason for tooltip */
  disableReason?: string
  /** If provided, enables drag-to-reorder on this item */
  sortableId?: string
  /** data-tutorial attribute value for tutorial targeting */
  dataTutorial?: string | undefined
}

interface EnabledIndicatorProps {
  enabled: boolean
  onToggle: () => void
}

function EnabledIndicator({ enabled, onToggle }: EnabledIndicatorProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'w-5 h-5 flex items-center justify-center rounded shrink-0',
        'hover:bg-muted-foreground/20 transition-colors',
      )}
      aria-label={enabled ? 'Disable graph' : 'Enable graph'}
    >
      <div
        className={cn(
          'w-2 h-2 rounded-full transition-all',
          enabled
            ? 'bg-foreground/70'
            : 'ring-1 ring-inset ring-muted-foreground/40',
        )}
      />
    </button>
  )
}

export function GraphListItem({
  graph,
  disableState,
  isSelected,
  onClick,
  onRename,
  onDelete,
  onToggleEnabled,
  disableReason,
  sortableId,
  dataTutorial,
}: GraphListItemProps) {
  const isUserDisabled = graph.enabled === false
  const isDependencyDisabled =
    disableState?.effective.kind === 'dependency-disabled'
  const isEffectivelyDisabled = isUserDisabled || isDependencyDisabled

  // Sortable hook - always called (hooks rule), but disabled when no sortableId
  const sortable = useSortable({
    id: sortableId ?? 'non-sortable',
    disabled: !sortableId,
  })

  const style: React.CSSProperties = sortableId
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.5 : 1,
      }
    : {}

  return (
    <button
      ref={sortable.setNodeRef}
      style={style}
      type="button"
      data-tutorial={dataTutorial}
      className={cn(
        'w-full group flex items-center gap-2 px-2 py-1.5 rounded-md',
        'hover:bg-muted/50 transition-colors text-left',
        isSelected && 'bg-muted',
        isEffectivelyDisabled && 'opacity-60',
        sortableId && 'cursor-grab active:cursor-grabbing touch-none',
      )}
      onClick={onClick}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      {/* Enabled indicator (replaces checkbox) */}
      <EnabledIndicator enabled={graph.enabled} onToggle={onToggleEnabled} />

      {/* Graph type icon */}
      <GraphIcon
        graph={graph}
        className={cn(
          'w-4 h-4 shrink-0',
          isEffectivelyDisabled ? 'text-muted-foreground' : 'text-foreground',
        )}
      />

      {/* Graph name */}
      <span
        className={cn(
          'flex-1 text-sm truncate',
          isEffectivelyDisabled && 'line-through',
        )}
      >
        {graph.name}
      </span>

      {/* Dependency-disabled warning */}
      {isDependencyDisabled && disableReason && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{disableReason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onToggleEnabled()
            }}
          >
            {graph.enabled ? (
              <>
                <PowerOff className="w-4 h-4 mr-2" />
                Disable
              </>
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                Enable
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onRename()
            }}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </button>
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
