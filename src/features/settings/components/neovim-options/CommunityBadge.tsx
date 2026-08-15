/**
 * CommunityBadge Component
 *
 * Displays a badge indicating community recommendation for an option.
 */

import { Star } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'

export function CommunityBadge(): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="gap-1 text-xs bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-900 dark:text-teal-100"
          >
            <Star className="h-3 w-3" />
            Popular choice
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">
            This setting is commonly used in modern Neovim configurations.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
