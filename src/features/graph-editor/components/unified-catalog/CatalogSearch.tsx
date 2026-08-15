import { Search } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'

export interface CatalogSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function CatalogSearch({
  value,
  onChange,
  placeholder = 'Search...',
}: CatalogSearchProps): React.JSX.Element {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id="catalog-search"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  )
}
