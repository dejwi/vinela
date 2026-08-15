import { forwardRef } from 'react'
import { cn } from '@/shared/lib/utils'
import type { CatalogPickerItemProps } from './types'

export const CatalogPickerItem = forwardRef<
  HTMLButtonElement,
  CatalogPickerItemProps
>(function CatalogPickerItem(
  {
    label,
    shortDescription,
    isSelected,
    isFocused,
    onClick,
    onMouseEnter,
    infoSlot,
  },
  ref,
): React.JSX.Element {
  return (
    <div
      className={cn(
        'relative rounded-lg border transition-colors',
        'hover:bg-accent hover:border-accent-foreground/20',
        isFocused && 'ring-2 ring-primary ring-offset-1',
        isSelected && 'bg-accent border-primary',
      )}
    >
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className="w-full p-3 text-left"
      >
        <div className="min-w-0 pr-8">
          <p className="font-medium text-sm truncate">{label}</p>
          <p className="text-xs text-muted-foreground truncate">
            {shortDescription}
          </p>
        </div>
      </button>

      {infoSlot && <div className="absolute top-2 right-2">{infoSlot}</div>}
    </div>
  )
})
