import { Blocks } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'

interface GraphSourceBadgeProps {
  graphName: string
  onClick: () => void
}

export function GraphSourceBadge({
  graphName,
  onClick,
}: GraphSourceBadgeProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={`This shortcut is defined in the Graph Editor. Click to view: ${graphName}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Blocks className="h-3 w-3" />
          <span>{graphName}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        This shortcut is defined in the Graph Editor. Click to view.
      </TooltipContent>
    </Tooltip>
  )
}
