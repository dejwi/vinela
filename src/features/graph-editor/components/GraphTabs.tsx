import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { Graph } from '@/shared/types'

interface GraphTabsProps {
  openGraphs: Graph[]
  activeGraphId: string
  onTabClick: (graphId: string) => void
  onTabClose: (graphId: string) => void
}

export function GraphTabs({
  openGraphs,
  activeGraphId,
  onTabClick,
  onTabClose,
}: GraphTabsProps) {
  if (openGraphs.length === 0) {
    return null
  }

  return (
    <div className="h-9 border-b bg-muted/30 flex items-end overflow-x-auto">
      {openGraphs.map((graph) => (
        <div
          key={graph.id}
          className={cn(
            'h-8 flex items-center gap-2 px-3 border-r cursor-pointer',
            'hover:bg-muted/50 transition-colors group',
            activeGraphId === graph.id
              ? 'bg-background border-t-2 border-t-primary'
              : 'bg-muted/20',
          )}
          onClick={() => onTabClick(graph.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onTabClick(graph.id)
            }
          }}
          role="tab"
          tabIndex={0}
          aria-selected={activeGraphId === graph.id}
        >
          <span className="text-sm truncate max-w-[120px]">{graph.name}</span>
          <button
            type="button"
            className={cn(
              'w-4 h-4 rounded-sm flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 hover:bg-muted',
              'transition-opacity',
            )}
            onClick={(e) => {
              e.stopPropagation()
              onTabClose(graph.id)
            }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
