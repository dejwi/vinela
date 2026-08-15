import { useEffect, useRef } from 'react'
import { ActionPickerItem } from './ActionPickerItem'
import type { ActionPickerGridProps } from './types'

export function ActionPickerGrid({
  actions,
  selectedAction,
  focusedIndex,
  onSelectAction,
  onFocusChange,
}: ActionPickerGridProps): React.JSX.Element {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  // Scroll focused item into view
  useEffect(() => {
    const focusedItem = itemRefs.current[focusedIndex]
    if (focusedItem) {
      focusedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedIndex])

  if (actions.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No actions found</p>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
        {actions.map((action, index) => (
          <ActionPickerItem
            key={action.key}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            action={action}
            isSelected={selectedAction?.key === action.key}
            isFocused={index === focusedIndex}
            onClick={() => onSelectAction(action)}
            onMouseEnter={() => onFocusChange(index)}
          />
        ))}
      </div>
    </div>
  )
}
