import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'

interface SelectItemWithInfoProps {
  value: string
  title: string
  description?: string
  tooltipContent?: React.ReactNode
  iconPosition?: 'right' | 'far-right'
}

export function SelectItemWithInfo({
  value,
  title,
  description,
  tooltipContent,
  iconPosition = 'far-right',
}: SelectItemWithInfoProps): React.JSX.Element {
  const tooltipLabel = tooltipContent ?? description
  const hasTooltip = tooltipLabel !== undefined && tooltipLabel !== ''

  const infoIcon = hasTooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="select-item-info-icon h-4 w-4 flex-none rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`More info: ${title}`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className="max-w-xs bg-popover text-popover-foreground border"
      >
        {typeof tooltipLabel === 'string' ? (
          <p>{tooltipLabel}</p>
        ) : (
          tooltipLabel
        )}
      </TooltipContent>
    </Tooltip>
  ) : null

  // Use raw Radix primitives so we can control what goes into ItemText
  // (which is what SelectValue renders in the trigger/collapsed view)
  // vs what's only visible in the dropdown list.

  if (iconPosition === 'far-right') {
    return (
      <SelectPrimitive.Item
        value={value}
        className={cn(
          'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          '[&[data-state=checked]_button.select-item-info-icon]:hidden',
        )}
      >
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          <SelectPrimitive.ItemIndicator>
            <Check className="h-4 w-4" />
          </SelectPrimitive.ItemIndicator>
        </span>

        <div className="flex items-center min-w-0 pr-6">
          <div className="flex flex-col min-w-0 flex-1 max-w-[calc(var(--radix-select-trigger-width)-60px)]">
            {/* Only the title goes inside ItemText — this is what shows in the trigger */}
            <SelectPrimitive.ItemText>
              <span className="font-medium">{title}</span>
            </SelectPrimitive.ItemText>
            {/* Description is outside ItemText — only visible in the dropdown */}
            {description && (
              <span className="text-xs text-muted-foreground truncate">
                {description}
              </span>
            )}
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4">
            {infoIcon}
          </div>
        </div>
      </SelectPrimitive.Item>
    )
  }

  // iconPosition === 'right'
  return (
    <SelectPrimitive.Item
      value={value}
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        '[&[data-state=checked]_button.select-item-info-icon]:hidden',
      )}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>

      <div className="flex items-center min-w-0 pr-6">
        <div className="flex flex-col min-w-0 flex-1">
          <SelectPrimitive.ItemText>
            <span className="font-medium">{title}</span>
          </SelectPrimitive.ItemText>
          {description && (
            <span className="text-xs text-muted-foreground truncate">
              {description}
            </span>
          )}
        </div>
        {hasTooltip && <div className="ml-2">{infoIcon}</div>}
      </div>
    </SelectPrimitive.Item>
  )
}
