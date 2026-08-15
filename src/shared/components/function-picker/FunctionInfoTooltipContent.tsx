import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import type { FunctionCatalogEntry } from '@/shared/data/function-catalog-types'

interface FunctionInfoTooltipProps {
  entry: FunctionCatalogEntry
}

export function FunctionInfoTooltip({
  entry,
}: FunctionInfoTooltipProps): React.JSX.Element {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
          className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          aria-label={`More details for ${entry.label}`}
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
          <h4 className="font-semibold text-sm leading-tight">{entry.label}</h4>

          {/* Signature */}
          <div className="space-y-1 pt-2 border-t border-zinc-700">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
              Signature
            </p>
            <code className="block p-2 rounded bg-zinc-800 border border-zinc-700 font-mono text-xs text-zinc-100">
              {entry.signature}
            </code>
          </div>

          {/* Description */}
          {entry.notes && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
                What it does
              </p>
              <p className="text-xs text-zinc-100">{entry.notes}</p>
            </div>
          )}

          {/* Returns */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
              Returns
            </p>
            <code className="block font-mono text-xs text-zinc-300">
              {entry.returns}
            </code>
          </div>

          {/* Source badge */}
          {entry.isPlugin && (
            <div className="pt-2 border-t border-zinc-700">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-medium">
                Plugin
              </span>
            </div>
          )}

          {/* Reference */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
              Reference
            </p>
            <code className="block font-mono text-[10px] text-zinc-400">
              {entry.sourceDoc}
            </code>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
