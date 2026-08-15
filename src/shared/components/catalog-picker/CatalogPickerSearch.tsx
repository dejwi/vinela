import { Search, X } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import type { CatalogPickerSearchProps } from './types'

export function CatalogPickerSearch({
  id,
  value,
  onChange,
  placeholder = 'Search...',
  disabled = false,
}: CatalogPickerSearchProps): React.JSX.Element {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
