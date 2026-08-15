import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import type { BrowseSortOption } from '../sort-filter'

// ============================================
// Sort option labels
// ============================================

const BROWSE_SORT_LABELS: Record<BrowseSortOption, string> = {
  'stars-desc': 'Stars (High→Low)',
  'name-asc': 'Name (A–Z)',
}

// ============================================
// BrowseSortDropdown
// ============================================

export interface BrowseSortDropdownProps {
  value: BrowseSortOption
  onChange: (option: BrowseSortOption) => void
}

/**
 * Sort dropdown for the Browse tab.
 *
 * Options:
 *   - "Stars (High→Low)"  → 'stars-desc'
 *   - "Name (A–Z)"        → 'name-asc'
 */
export function BrowseSortDropdown({
  value,
  onChange,
}: BrowseSortDropdownProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Sort by</span>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as BrowseSortOption)}
      >
        <SelectTrigger className="w-[160px] min-h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(
            Object.entries(BROWSE_SORT_LABELS) as [BrowseSortOption, string][]
          ).map(([optionValue, label]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
