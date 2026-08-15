import { forwardRef } from 'react'
import { CatalogPickerItem } from '@/shared/components/catalog-picker'
import { ActionInfoTooltip } from './ActionInfoTooltip'
import type { ActionPickerItemProps } from './types'

export const ActionPickerItem = forwardRef<
  HTMLButtonElement,
  ActionPickerItemProps
>(function ActionPickerItem(
  { action, isSelected, isFocused, onClick, onMouseEnter },
  ref,
): React.JSX.Element {
  return (
    <CatalogPickerItem
      ref={ref}
      label={action.label}
      shortDescription={action.shortDescription}
      isSelected={isSelected}
      isFocused={isFocused}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      infoSlot={<ActionInfoTooltip action={action} />}
    />
  )
})
