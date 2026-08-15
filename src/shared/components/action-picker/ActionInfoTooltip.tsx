import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import type { CatalogActionEntry } from '@/shared/types/catalog'

interface ActionInfoTooltipProps {
  action: CatalogActionEntry
}

export function ActionInfoTooltip({
  action,
}: ActionInfoTooltipProps): React.JSX.Element {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
          className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          aria-label={`More details for ${action.label}`}
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="end"
        sideOffset={4}
        className="w-80 p-4 bg-zinc-900 text-zinc-100 border border-zinc-700 shadow-md rounded-md"
      >
        <div className="space-y-3">
          {/* Title row with label */}
          <h4 className="font-semibold text-sm leading-tight">
            {action.label}
          </h4>

          {/* What it does */}
          <div className="space-y-1 pt-2 border-t border-zinc-700">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
              What it does
            </p>
            <p className="text-xs text-zinc-100">{action.whatItDoes}</p>
          </div>

          {/* Technical note */}
          {action.technicalNote && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
                Technical note
              </p>
              <p className="text-xs text-zinc-300 italic">
                {action.technicalNote}
              </p>
            </div>
          )}

          {/* Example */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
              Example
            </p>
            <code className="block p-2 rounded bg-zinc-800 border border-zinc-700 font-mono text-xs text-zinc-100">
              {action.example}
            </code>
          </div>

          {/* Reference */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
              Reference
            </p>
            <code className="block font-mono text-[10px] text-zinc-400">
              {action.sourceDoc}
            </code>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
