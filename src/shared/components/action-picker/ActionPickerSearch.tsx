import { CatalogPickerSearch } from '@/shared/components/catalog-picker'
import type { ActionPickerSearchProps } from './types'

export function ActionPickerSearch({
  id,
  value,
  onChange,
  placeholder = 'Search actions...',
  disabled = false,
}: ActionPickerSearchProps): React.JSX.Element {
  return (
    <CatalogPickerSearch
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}
