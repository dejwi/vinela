import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import type { CatalogActionEntry } from '@/shared/types/catalog'

interface ActionInfoTooltipCompactProps {
  action: CatalogActionEntry
}

export function ActionInfoTooltipCompact({
  action,
}: ActionInfoTooltipCompactProps): React.JSX.Element | null {
  // Only show if there's advanced content to display
  const hasAdvancedContent =
    action.technicalNote || action.example || action.sourceDoc

  if (!hasAdvancedContent) {
    return null
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
          className="p-1 rounded hover:bg-accent/50 transition-colors"
          aria-label="More details"
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-72 p-3 space-y-3 bg-zinc-900 text-zinc-100 border border-zinc-700"
      >
        {/* Technical Note */}
        {action.technicalNote && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-zinc-400">
              Technical Details
            </p>
            <p className="text-xs text-zinc-300 italic">
              {action.technicalNote}
            </p>
          </div>
        )}

        {/* Example */}
        {action.example && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-zinc-400">Example</p>
            <code className="block p-2 rounded bg-zinc-800 border border-zinc-700 font-mono text-xs text-zinc-100">
              {action.example}
            </code>
          </div>
        )}

        {/* Reference */}
        {action.sourceDoc && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-zinc-400">Reference</p>
            <code className="font-mono text-[11px] text-zinc-400">
              {action.sourceDoc}
            </code>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
