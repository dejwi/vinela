/**
 * ConflictBadge Component
 *
 * Displays a badge when an option is also set in graph automation.
 * Shows improved copy and "View where" navigation.
 */

import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import type { OptionConflictSummary } from '@/shared/types/neovim-options'

export interface ConflictBadgeProps {
  conflict: OptionConflictSummary
  onNavigate?: (location: { graphId: string; nodeId: string }) => void
}

export function ConflictBadge({
  conflict,
  onNavigate,
}: ConflictBadgeProps): React.JSX.Element | null {
  if (conflict.type === 'none' || conflict.locations.length === 0) {
    return null
  }

  const isMultiple = conflict.type === 'set-multiple-times-in-graphs'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="gap-1 text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100 cursor-pointer"
            onClick={() => {
              if (onNavigate && conflict.locations[0]) {
                onNavigate({
                  graphId: conflict.locations[0].graphId,
                  nodeId: conflict.locations[0].nodeId,
                })
              }
            }}
          >
            <AlertTriangle className="h-3 w-3" />
            {isMultiple ? 'Multiple automations' : 'Also in automation'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-2">
            <p>
              {isMultiple
                ? 'This setting is changed in multiple automation flows. The final value depends on which flow runs last.'
                : 'This setting may be changed by your automation flows.'}
            </p>
            <div className="text-sm">
              <p className="font-medium mb-1">This option is also set in:</p>
              <ul className="space-y-1">
                {conflict.locations.map((loc) => (
                  <li key={`${loc.graphId}-${loc.nodeId}`}>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate?.({
                          graphId: loc.graphId,
                          nodeId: loc.nodeId,
                        })
                      }
                      className="text-left hover:underline text-amber-600 dark:text-amber-400"
                    >
                      {loc.graphName} → {loc.nodeLabel}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              The value set here applies first. Automation flows may change it
              when they run.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
