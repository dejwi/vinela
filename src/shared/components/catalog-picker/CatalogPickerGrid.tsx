import { useEffect, useRef } from 'react'
import { CatalogPickerItem } from './CatalogPickerItem'
import type { CatalogPickerGridProps, CatalogPickerItemData } from './types'

export function CatalogPickerGrid<T extends CatalogPickerItemData>({
  items,
  selectedKey,
  focusedIndex,
  onSelect,
  onFocusChange,
  renderInfoSlot,
  emptyMessage = 'No items found',
}: CatalogPickerGridProps<T>): React.JSX.Element {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    const focusedItem = itemRefs.current[focusedIndex]
    if (focusedItem) {
      focusedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedIndex])

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
        {items.map((item, index) => (
          <CatalogPickerItem
            key={item.key}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            label={item.label}
            shortDescription={item.shortDescription}
            isSelected={selectedKey === item.key}
            isFocused={index === focusedIndex}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onFocusChange(index)}
            infoSlot={renderInfoSlot?.(item)}
          />
        ))}
      </div>
    </div>
  )
}
