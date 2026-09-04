import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { RunCustomActionTargetStatus } from '../custom-action-target-status'
import { findConflictForEntry } from '../hooks/useKeymapConflicts'
import type {
  KeymapConflict,
  KeymapEntry,
  KeymapSort,
  KeymapSortDirection,
  KeymapSortField,
  ProjectKeymap,
} from '../types'
import { KeymapRow } from './KeymapRow'

interface KeymapListProps {
  entries: KeymapEntry[]
  conflicts: KeymapConflict[]
  sort: KeymapSort
  onSortChange: (sort: KeymapSort) => void
  onEdit: (keymap: ProjectKeymap) => void
  /** Called when user requests to delete a keymap (shows confirmation dialog) */
  onDeleteRequest: (keymap: ProjectKeymap) => void
  onToggle: (keymapId: string) => void
  onEnabledOverrideChange: (
    keymapId: string,
    enabledOverride: boolean | undefined,
  ) => void
  profilesReady: boolean
  onNavigateToNode: (graphId: string, nodeId: string) => void
  onNavigateToGraph: (graphId: string) => void
  getRunCustomActionTargetStatus: (
    graphId: string,
  ) => RunCustomActionTargetStatus
}

function getEntryKey(entry: KeymapEntry): string {
  // Include graphId to avoid collisions when the same nodeId exists in different graphs
  return entry.source === 'graph'
    ? `graph-${entry.graphId}-${entry.nodeId}`
    : `manual-${entry.keymapId}`
}

function SortableHeader({
  field,
  label,
  sort,
  onSortChange,
}: {
  field: KeymapSortField
  label: string
  sort: KeymapSort
  onSortChange: (sort: KeymapSort) => void
}): React.JSX.Element {
  const isActive = sort.field === field
  const nextDirection: KeymapSortDirection =
    isActive && sort.direction === 'asc' ? 'desc' : 'asc'

  return (
    <button
      type="button"
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      aria-label={`Sort by ${label}`}
      onClick={() => onSortChange({ field, direction: nextDirection })}
    >
      <span>{label}</span>
      {isActive ? (
        sort.direction === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  )
}

export function KeymapList({
  entries,
  conflicts,
  sort,
  onSortChange,
  onEdit,
  onDeleteRequest,
  onToggle,
  onEnabledOverrideChange,
  profilesReady,
  onNavigateToNode,
  onNavigateToGraph,
  getRunCustomActionTargetStatus,
}: KeymapListProps): React.JSX.Element {
  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="grid grid-cols-[60px_140px_1fr_120px_170px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <SortableHeader
          field="mode"
          label="Mode"
          sort={sort}
          onSortChange={onSortChange}
        />
        <SortableHeader
          field="keySequence"
          label="Key"
          sort={sort}
          onSortChange={onSortChange}
        />
        <span>Action</span>
        <SortableHeader
          field="source"
          label="Source"
          sort={sort}
          onSortChange={onSortChange}
        />
        <span />
      </div>

      {/* Rows */}
      {entries.map((entry) => (
        <KeymapRow
          key={getEntryKey(entry)}
          entry={entry}
          conflict={findConflictForEntry(conflicts, entry)}
          onEdit={onEdit}
          onDeleteRequest={onDeleteRequest}
          onToggle={onToggle}
          onEnabledOverrideChange={onEnabledOverrideChange}
          profilesReady={profilesReady}
          onNavigateToNode={onNavigateToNode}
          onNavigateToGraph={onNavigateToGraph}
          getRunCustomActionTargetStatus={getRunCustomActionTargetStatus}
        />
      ))}
    </div>
  )
}
