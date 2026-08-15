import { AlertTriangle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'

export function ConflictBadge(): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label="Warning: this key combination is used by another shortcut in the same mode"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        This key combination is used by another shortcut in the same mode
      </TooltipContent>
    </Tooltip>
  )
}
