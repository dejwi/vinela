import { Switch } from '@/shared/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'

interface EnableToggleProps {
  enabled: boolean
  onToggle: () => void
}

export function EnableToggle({
  enabled,
  onToggle,
}: EnableToggleProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            aria-label="Enable keyboard shortcut"
            size="sm"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {enabled
          ? 'Shortcut is active'
          : "This shortcut is disabled and won't be included when generating your Neovim config"}
      </TooltipContent>
    </Tooltip>
  )
}
